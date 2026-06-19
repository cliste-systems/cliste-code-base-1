import { NextResponse } from "next/server";

import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import { sendTwilioBookingSms } from "@/lib/booking-confirmation-sms";
import { formatCallerSmsBody } from "@/lib/caller-sms-content";
import { resolveOrgAssignedPhoneE164 } from "@/lib/org-assigned-phone";
import { getCallerSmsQuotaStatus } from "@/lib/sms-quota";
import {
  authorizeVoiceWebhook,
  voiceWebhookNoSecretResponse,
  voiceWebhookUnauthorizedResponse,
} from "@/lib/voice-webhook-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_SMS_BODY_LENGTH = 1600;

type SendSmsBody = {
  called_number?: string;
  to: string;
  body: string;
  purpose?: string;
  /**
   * Required in production: Cara must have asked the caller on the call and
   * received verbal consent before texting this number.
   */
  caller_consented?: boolean;
  /** When true, send `body` verbatim (no business-name prefix). */
  skip_business_prefix?: boolean;
};

function requireCallerConsent(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Voice worker: send caller-facing SMS from the org's assigned Irish DID.
 * Requires active org, remaining monthly SMS quota, verbal consent, and a
 * provisioned number. Message body may be just the link — no legal boilerplate
 * is appended (see docs/legal/VOICE-COMPLIANCE-CHECKLIST.md §5).
 */
export async function POST(request: Request) {
  const auth = await authorizeVoiceWebhook(request);
  if (auth === "no_secret") return voiceWebhookNoSecretResponse();
  if (auth === "bad") return voiceWebhookUnauthorizedResponse();

  let body: SendSmsBody;
  try {
    body = (await request.json()) as SendSmsBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const calledNumberRaw = String(body.called_number ?? "").trim();
  if (!calledNumberRaw) {
    return NextResponse.json(
      { ok: false, error: "called_number is required" },
      { status: 400 },
    );
  }

  const toRaw = String(body.to ?? "").trim();
  if (!toRaw) {
    return NextResponse.json(
      { ok: false, error: "to is required" },
      { status: 400 },
    );
  }

  const smsBody = String(body.body ?? "").trim();
  if (!smsBody) {
    return NextResponse.json(
      { ok: false, error: "body is required" },
      { status: 400 },
    );
  }
  if (requireCallerConsent() && body.caller_consented !== true) {
    return NextResponse.json(
      {
        ok: false,
        code: "caller_consent_required",
        error:
          "caller_consented must be true — Cara must ask on the call before texting",
      },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Server configuration error",
      },
      { status: 503 },
    );
  }

  const calledE164 =
    normalizeCustomerPhoneE164(calledNumberRaw) || calledNumberRaw;
  const { data: phoneRow, error: phoneErr } = await admin
    .from("phone_numbers")
    .select("organization_id")
    .eq("e164", calledE164)
    .maybeSingle();

  if (phoneErr) {
    console.error("[voice/send-sms] phone lookup", phoneErr);
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

  const orgId = phoneRow.organization_id as string;

  const { data: orgRow } = await admin
    .from("organizations")
    .select("name, is_active")
    .eq("id", orgId)
    .maybeSingle();
  if (!orgRow?.is_active) {
    return NextResponse.json(
      { ok: false, code: "org_suspended", error: "Organization is not active" },
      { status: 403 },
    );
  }

  const quota = await getCallerSmsQuotaStatus(admin, orgId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "sms_quota_exhausted",
        error: "Monthly SMS quota exhausted for this account",
        quota,
      },
      { status: 429 },
    );
  }

  const fromE164 = await resolveOrgAssignedPhoneE164(admin, orgId);
  if (!fromE164) {
    return NextResponse.json(
      {
        ok: false,
        code: "no_assigned_number",
        error: "Organization has no assigned phone number",
      },
      { status: 422 },
    );
  }

  const toE164 = normalizeCustomerPhoneE164(toRaw) || toRaw;
  const purpose = String(body.purpose ?? "caller_outbound").trim() || "caller_outbound";

  const businessName = String(orgRow?.name ?? "").trim() || "Your business";
  const outboundBody = body.skip_business_prefix
    ? smsBody
    : formatCallerSmsBody({ businessName, body: smsBody });

  if (outboundBody.length > MAX_SMS_BODY_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `body exceeds ${MAX_SMS_BODY_LENGTH} characters after formatting`,
      },
      { status: 400 },
    );
  }

  const result = await sendTwilioBookingSms(toE164, outboundBody, {
    organizationId: orgId,
    purpose,
    fromE164,
  });

  if (!result.ok) {
    const lower = result.message.toLowerCase();
    const landline =
      lower.includes("21614") ||
      lower.includes("landline") ||
      lower.includes("cannot be a landline");
    return NextResponse.json(
      {
        ok: false,
        code: landline ? "landline_destination" : "send_failed",
        error: result.message,
      },
      { status: landline ? 422 : 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    from: fromE164,
    to: toE164,
    quota: {
      remaining: Math.max(0, quota.remaining - 1),
      includedSms: quota.includedSms,
    },
  });
}
