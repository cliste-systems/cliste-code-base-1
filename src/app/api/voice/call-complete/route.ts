import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";

import {
  APPOINTMENT_OVERLAP_MESSAGE,
  hasConfirmedAppointmentOverlap,
  isDatabaseOverlapConstraintError,
} from "@/lib/appointments-overlap";
import { generateBookingReference, normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import { normalizeCallOutcome } from "@/lib/call-history-types";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
import { notifyActionInboxOwner } from "@/lib/action-inbox-notify";
import { ingestCallKnowledgeGaps } from "@/lib/cara-training-ingest";
import type { KnowledgeGapPayload } from "@/lib/cara-training-types";
import { redactCallText } from "@/lib/transcript-redaction";
import { captureObservedError } from "@/lib/observability";
import { logDisclosureCompliance } from "@/lib/voice-compliance";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BookingPayload = {
  customer_name: string;
  customer_phone: string;
  service_id: string;
  start_time: string;
  end_time: string;
  ai_booking_notes?: string | null;
  confirmation_sms_sent_at?: string | null;
};

type VoiceCallCompleteBody = {
  /**
   * @deprecated The org id is now derived server-side from `called_number` →
   * `phone_numbers.organization_id`. Still accepted for compat with older
   * worker builds; if both are sent and they disagree, we trust the lookup
   * and reject the request (defends against shared-secret-only forgery).
   */
  organization_id?: string;
  /** E.164 of the SIP DID the call landed on. REQUIRED — used to look up the tenant. */
  called_number?: string;
  /** Stable Twilio/LiveKit call id — required for idempotent webhook retries. */
  call_sid?: string;
  /** LiveKit room name when available. */
  room_name?: string | null;
  caller_number: string;
  /** Optional display name for Contacts / call history when the worker knows it. */
  caller_name?: string | null;
  duration_seconds?: number;
  /**
   * Free-text or canonical outcome. Normalized server-side to the stable v1
   * set in `@/lib/call-history-types` (answered, link_sent, callback_requested,
   * action_created, failed, voicemail_or_no_speech, spam_or_abuse).
   */
  outcome: string;
  transcript?: string | null;
  transcript_review?: string | null;
  ai_summary?: string | null;
  /** When true, worker confirms AI + recording/transcription disclosure was spoken. */
  disclosure_confirmed?: boolean;
  /** When set, creates a native appointment tied to this call log. */
  booking?: BookingPayload | null;
  /** Optional knowledge gaps Cara could not answer — creates Cara Training items. */
  knowledge_gaps?: KnowledgeGapPayload[] | null;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function voiceSecretNotConfigured() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Set CLISTE_VOICE_WEBHOOK_SECRET in .env.local (same value in your voice worker).",
    },
    { status: 503 },
  );
}

async function authorize(request: Request): Promise<"ok" | "no_secret" | "bad"> {
  const secret = process.env.CLISTE_VOICE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return "no_secret";
  }
  const auth = request.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cliste-voice-secret");
  const token = bearer ?? header ?? "";
  return (await timingSafeEqualUtf8(token, secret)) ? "ok" : "bad";
}

/**
 * Called by the LiveKit / voice worker after a call ends.
 * Inserts `call_logs` (→ Call history, dashboard feed). Optionally creates an
 * `appointments` row with `source = ai_call` and `call_log_id`.
 *
 * Configure the worker with the same secret as `CLISTE_VOICE_WEBHOOK_SECRET`
 * and POST JSON with `Authorization: Bearer <secret>`.
 */
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth === "no_secret") {
    return voiceSecretNotConfigured();
  }
  if (auth === "bad") {
    return unauthorized();
  }

  let body: VoiceCallCompleteBody;
  try {
    body = (await request.json()) as VoiceCallCompleteBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const calledNumberRaw = String(body.called_number ?? "").trim();
  const claimedOrgId = String(body.organization_id ?? "").trim();
  // The shared webhook secret only proves "the call came from a worker we
  // trust" — it must NOT decide which tenant to bill / write into. Trusting
  // organization_id from the body would mean a leaked secret = cross-tenant
  // write capability, so called_number is required by default.
  //
  // Set CLISTE_VOICE_ALLOW_LEGACY_ORG_ID=1 ONLY to temporarily accept the old
  // org-id-only worker payload during a worker rollout. Remove the flag (and
  // the legacy branch below) once every worker sends called_number.
  const allowLegacyOrgIdOnly =
    process.env.CLISTE_VOICE_ALLOW_LEGACY_ORG_ID?.trim().toLowerCase() === "1" ||
    process.env.CLISTE_VOICE_ALLOW_LEGACY_ORG_ID?.trim().toLowerCase() === "true";
  const requireCalledNumber = !allowLegacyOrgIdOnly;
  if (!calledNumberRaw && !claimedOrgId) {
    return NextResponse.json(
      { ok: false, error: "called_number (or legacy organization_id) is required" },
      { status: 400 },
    );
  }
  if (!calledNumberRaw && requireCalledNumber) {
    return NextResponse.json(
      { ok: false, error: "called_number is required (organization_id-only writes are disabled)" },
      { status: 400 },
    );
  }

  const callerNumberRaw = String(body.caller_number ?? "").trim();
  if (!callerNumberRaw) {
    return NextResponse.json(
      { ok: false, error: "caller_number is required" },
      { status: 400 },
    );
  }
  const callerNumber =
    normalizeCustomerPhoneE164(callerNumberRaw) || callerNumberRaw;

  const callSid = String(body.call_sid ?? "").trim() || null;
  const roomName =
    typeof body.room_name === "string" ? body.room_name.trim().slice(0, 200) || null : null;

  const requireCallSid =
    process.env.NODE_ENV === "production" ||
    process.env.CLISTE_VOICE_REQUIRE_CALLED_NUMBER?.trim().toLowerCase() === "1" ||
    process.env.CLISTE_VOICE_REQUIRE_CALLED_NUMBER?.trim().toLowerCase() === "true";
  if (requireCallSid && !callSid) {
    return NextResponse.json(
      { ok: false, error: "call_sid is required" },
      { status: 400 },
    );
  }

  const rawOutcome = String(body.outcome ?? "").trim();
  if (!rawOutcome) {
    return NextResponse.json(
      { ok: false, error: "outcome is required" },
      { status: 400 },
    );
  }
  // Normalize to the stable v1 outcome set so dashboard metrics (e.g. "Routing
  // links sent") never depend on free-text the worker happens to send. Older
  // workers can keep sending free text; this maps it to a canonical value.
  const outcome = normalizeCallOutcome(rawOutcome);

  const durationSeconds = Math.max(
    0,
    Math.floor(Number(body.duration_seconds ?? 0)) || 0,
  );

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error ? e.message : "Server configuration error",
      },
      { status: 503 },
    );
  }

  // Derive the tenant from the called number (the SIP DID the caller dialled).
  // The shared webhook secret only proves "the call came from a worker we
  // trust" — it must NOT decide which tenant to bill / write into. Trusting
  // organization_id from the body would mean a leaked secret = cross-tenant
  // write capability. The phone_numbers table is the source of truth: each
  // assigned DID belongs to exactly one org.
  let orgId: string | null = null;
  if (calledNumberRaw) {
    const calledE164 = normalizeCustomerPhoneE164(calledNumberRaw) || calledNumberRaw;
    const { data: phoneRow, error: phoneErr } = await admin
      .from("phone_numbers")
      .select("organization_id, status")
      .eq("e164", calledE164)
      .maybeSingle();
    if (phoneErr) {
      console.error("[voice/call-complete] phone lookup", phoneErr);
      return NextResponse.json(
        { ok: false, error: "Database error" },
        { status: 500 },
      );
    }
    if (!phoneRow?.organization_id) {
      return NextResponse.json(
        {
          ok: false,
          error: `called_number ${calledE164} is not assigned to any organization`,
        },
        { status: 404 },
      );
    }
    orgId = phoneRow.organization_id as string;
    // If the worker also sent organization_id, it MUST match the lookup —
    // a mismatch is either a worker bug or an exploit attempt.
    if (claimedOrgId && claimedOrgId !== orgId) {
      console.warn(
        "[voice/call-complete] called_number resolved to org",
        orgId,
        "but body.organization_id was",
        claimedOrgId,
        "- rejecting",
      );
      return NextResponse.json(
        { ok: false, error: "organization_id does not match called_number" },
        { status: 403 },
      );
    }
  } else {
    // Legacy path (compat). Validate UUID, then verify org exists. This
    // branch will be removed once CLISTE_VOICE_REQUIRE_CALLED_NUMBER=1.
    if (!UUID_RE.test(claimedOrgId)) {
      return NextResponse.json(
        { ok: false, error: "organization_id must be a valid UUID" },
        { status: 400 },
      );
    }
    const { data: orgRow, error: orgErr } = await admin
      .from("organizations")
      .select("id")
      .eq("id", claimedOrgId)
      .maybeSingle();
    if (orgErr) {
      console.error("[voice/call-complete] org lookup", orgErr);
      return NextResponse.json(
        { ok: false, error: "Database error" },
        { status: 500 },
      );
    }
    if (!orgRow) {
      return NextResponse.json(
        { ok: false, error: "Organization not found" },
        { status: 404 },
      );
    }
    orgId = claimedOrgId;
  }
  if (!orgId) {
    return NextResponse.json(
      { ok: false, error: "Could not resolve organization for this call" },
      { status: 400 },
    );
  }

  const { data: orgRow, error: orgActiveErr } = await admin
    .from("organizations")
    .select("is_active, status")
    .eq("id", orgId)
    .maybeSingle();
  if (orgActiveErr) {
    await captureObservedError(orgActiveErr, { route: "voice/call-complete", orgId });
    return NextResponse.json(
      { ok: false, error: "Database error" },
      { status: 500 },
    );
  }
  if (!orgRow?.is_active) {
    return NextResponse.json(
      { ok: false, code: "org_suspended", error: "Organization is not active" },
      { status: 403 },
    );
  }

  if (callSid) {
    const { data: existing } = await admin
      .from("call_logs")
      .select("id")
      .eq("call_sid", callSid)
      .maybeSingle();
    if (existing?.id) {
      return NextResponse.json({
        ok: true,
        call_log_id: existing.id,
        idempotent: true,
      });
    }
  }

  logDisclosureCompliance({
    confirmed: body.disclosure_confirmed === true,
    organizationId: orgId,
    calledNumber: calledNumberRaw || undefined,
  });

  // Server-side redaction.
  // back card / PPS / DOB; this is the belt-and-braces step that runs
  // even if the agent slips. Hits are logged (without the matched text)
  // so we can spot patterns of callers volunteering sensitive data.
  const transcriptRedacted = redactCallText(body.transcript ?? null);
  const reviewRedacted = redactCallText(body.transcript_review ?? null);
  const summaryRedacted = redactCallText(body.ai_summary ?? null);
  const allHits = [
    ...transcriptRedacted.hits,
    ...reviewRedacted.hits,
    ...summaryRedacted.hits,
  ];
  if (allHits.length > 0) {
    const uniqueHits = Array.from(new Set(allHits));
    console.warn("[voice/call-complete] redacted sensitive tokens", {
      hits: uniqueHits,
      org: orgId,
      sensitive_content_redacted: uniqueHits.includes("SENSITIVE"),
    });
  }

  const callerName = String(body.caller_name ?? "").trim().slice(0, 120) || null;

  const { data: insertedCall, error: callErr } = await admin
    .from("call_logs")
    .insert({
      organization_id: orgId,
      caller_number: callerNumber,
      caller_name: callerName,
      duration_seconds: durationSeconds,
      outcome,
      transcript: transcriptRedacted.text,
      transcript_review: reviewRedacted.text,
      ai_summary: summaryRedacted.text,
      ...(callSid ? { call_sid: callSid } : {}),
      ...(roomName ? { room_name: roomName } : {}),
    })
    .select("id")
    .single();

  if (callErr) {
    if (callSid && callErr.code === "23505") {
      const { data: existing } = await admin
        .from("call_logs")
        .select("id")
        .eq("call_sid", callSid)
        .maybeSingle();
      if (existing?.id) {
        return NextResponse.json({
          ok: true,
          call_log_id: existing.id,
          idempotent: true,
        });
      }
    }
    await captureObservedError(callErr, { route: "voice/call-complete", orgId });
    return NextResponse.json(
      { ok: false, error: "Failed to save call log" },
      { status: 500 },
    );
  }
  if (!insertedCall?.id) {
    return NextResponse.json(
      { ok: false, error: "Failed to save call log" },
      { status: 500 },
    );
  }

  const callLogId = insertedCall.id as string;
  let appointmentId: string | null = null;

  const booking = body.booking;
  if (booking && typeof booking === "object") {
    const customerName = String(booking.customer_name ?? "").trim();
    const customerPhone = String(booking.customer_phone ?? "").trim();
    const serviceId = String(booking.service_id ?? "").trim();
    if (!customerName || !customerPhone || !UUID_RE.test(serviceId)) {
      revalidateAfterWrite();
      return NextResponse.json(
        {
          ok: true,
          call_log_id: callLogId,
          warning:
            "Call saved; booking skipped (customer_name, customer_phone, service_id invalid).",
        },
        { status: 200 },
      );
    }

    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      revalidateAfterWrite();
      return NextResponse.json(
        {
          ok: true,
          call_log_id: callLogId,
          warning: "Call saved; booking skipped (invalid start_time/end_time).",
        },
        { status: 200 },
      );
    }

    const { data: svc, error: svcErr } = await admin
      .from("services")
      .select("id")
      .eq("id", serviceId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (svcErr || !svc) {
      revalidateAfterWrite();
      return NextResponse.json(
        {
          ok: true,
          call_log_id: callLogId,
          warning: "Call saved; booking skipped (service not found for org).",
        },
        { status: 200 },
      );
    }

    const { overlap, error: ovErr } = await hasConfirmedAppointmentOverlap(
      admin,
      orgId,
      start,
      end,
    );
    if (ovErr) {
      revalidateAfterWrite();
      return NextResponse.json(
        {
          ok: true,
          call_log_id: callLogId,
          warning: `Call saved; booking skipped (${ovErr}).`,
        },
        { status: 200 },
      );
    }
    if (overlap) {
      revalidateAfterWrite();
      return NextResponse.json(
        {
          ok: true,
          call_log_id: callLogId,
          warning: `Call saved; booking skipped (${APPOINTMENT_OVERLAP_MESSAGE})`,
        },
        { status: 200 },
      );
    }

    const notes =
      typeof booking.ai_booking_notes === "string"
        ? booking.ai_booking_notes.trim() || null
        : null;
    const confirmAt =
      typeof booking.confirmation_sms_sent_at === "string" &&
      booking.confirmation_sms_sent_at.trim()
        ? booking.confirmation_sms_sent_at.trim()
        : null;

    const phoneE164 = normalizeCustomerPhoneE164(customerPhone);

    let apptErr: { message: string } | null = null;
    let appt: { id: string } | null = null;
    for (let attempt = 0; attempt < 14; attempt++) {
      const ref = generateBookingReference();
      const res = await admin
        .from("appointments")
        .insert({
          organization_id: orgId,
          customer_name: customerName,
          customer_phone: phoneE164,
          service_id: serviceId,
          booking_reference: ref,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: "confirmed",
          source: "ai_call",
          call_log_id: callLogId,
          ai_booking_notes: notes,
          ...(confirmAt
            ? { confirmation_sms_sent_at: confirmAt }
            : {}),
        })
        .select("id")
        .single();

      if (!res.error && res.data?.id) {
        appt = { id: res.data.id as string };
        apptErr = null;
        break;
      }
      const msg = res.error?.message ?? "";
      if (msg.includes("booking_reference") || msg.includes("23505")) {
        continue;
      }
      apptErr = { message: msg };
      break;
    }

    if (apptErr) {
      revalidateAfterWrite();
      return NextResponse.json(
        {
          ok: true,
          call_log_id: callLogId,
          warning: isDatabaseOverlapConstraintError(apptErr.message)
            ? `Call saved; booking skipped (${APPOINTMENT_OVERLAP_MESSAGE})`
            : `Call saved; booking failed.`,
        },
        { status: 200 },
      );
    }

    if (!appt?.id) {
      revalidateAfterWrite();
      return NextResponse.json(
        {
          ok: true,
          call_log_id: callLogId,
          warning:
            "Call saved; booking failed (could not allocate booking reference).",
        },
        { status: 200 },
      );
    }

    appointmentId = appt.id;
  }

  const knowledgeGaps = Array.isArray(body.knowledge_gaps)
    ? body.knowledge_gaps.filter(
        (g): g is KnowledgeGapPayload =>
          g != null &&
          typeof g === "object" &&
          String((g as KnowledgeGapPayload).topic ?? "").trim().length > 0,
      )
    : [];

  if (outcome === "spam_or_abuse") {
    const { error: abuseErr } = await admin.rpc("increment_caller_abuse_hit", {
      p_org_id: orgId,
      p_caller: callerNumber,
    });
    if (abuseErr) {
      console.warn("[voice/call-complete] abuse signal", abuseErr.message);
    }
  }

  after(async () => {
    if (outcome === "action_created") {
      const notifySummary =
        summaryRedacted.text?.trim() ||
        reviewRedacted.text?.trim() ||
        "A caller needs follow-up in your Action Inbox.";
      try {
        await notifyActionInboxOwner(admin, orgId, {
          summary: notifySummary,
          callerNumber,
          callerName,
        });
      } catch (e) {
        await captureObservedError(e, {
          route: "voice/call-complete",
          sideEffect: "action_inbox_notify",
          orgId,
        });
      }
    }
    if (knowledgeGaps.length > 0) {
      try {
        await ingestCallKnowledgeGaps(admin, orgId, callLogId, knowledgeGaps);
      } catch (e) {
        await captureObservedError(e, {
          route: "voice/call-complete",
          sideEffect: "knowledge_gaps",
          orgId,
        });
      }
    }
  });

  revalidateAfterWrite();

  return NextResponse.json({
    ok: true,
    call_log_id: callLogId,
    ...(appointmentId ? { appointment_id: appointmentId } : {}),
  });
}

function revalidateAfterWrite() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calls");
  revalidatePath("/dashboard/call-history");
  revalidatePath("/dashboard/action-inbox");
  revalidatePath("/dashboard/cara-training");
}
