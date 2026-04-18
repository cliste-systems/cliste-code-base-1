"use server";

import { revalidatePath } from "next/cache";

import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import { requireDashboardSession } from "@/lib/dashboard-session";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { headers } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";

export type GdprExportResult =
  | { ok: true; data: GdprExportPayload; phoneE164: string }
  | { ok: false; message: string };

export type GdprErasureResult =
  | { ok: true; affected: GdprErasureCounts; phoneE164: string }
  | { ok: false; message: string };

export type GdprExportPayload = {
  generated_at: string;
  organization_id: string;
  customer_phone_e164: string;
  appointments: Record<string, unknown>[];
  call_logs: Record<string, unknown>[];
  action_tickets: Record<string, unknown>[];
};

export type GdprErasureCounts = {
  appointments_anonymised: number;
  call_logs_redacted: number;
  action_tickets_redacted: number;
};

function normalizePhoneOrNull(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const e164 = normalizeCustomerPhoneE164(trimmed);
  if (!/^\+\d{8,16}$/.test(e164)) return null;
  return e164;
}

/**
 * Article 15 right of access — assemble every row Cliste holds for a
 * customer phone number, scoped to the requesting salon. Returned as a
 * structured payload the operator can hand to the customer (we render it
 * as JSON in the UI; the operator can copy/paste or download).
 */
export async function exportCustomerData(
  formData: FormData,
): Promise<GdprExportResult> {
  const session = await requireDashboardSession();
  const phoneRaw = String(formData.get("phone") ?? "");
  const phoneE164 = normalizePhoneOrNull(phoneRaw);
  if (!phoneE164) {
    return {
      ok: false,
      message: "Enter a valid Irish (+353) or international mobile number.",
    };
  }

  // Use the dashboard session's client (RLS-scoped to this org) so we
  // can never leak data from another tenant by accident.
  const sb = session.supabase;

  const [appts, calls, tickets] = await Promise.all([
    sb
      .from("appointments")
      .select(
        "id, customer_name, customer_phone, customer_email, service_id, start_time, end_time, status, source, payment_status, amount_cents, currency, booking_reference, created_at",
      )
      .eq("organization_id", session.organizationId)
      .eq("customer_phone", phoneE164)
      .limit(500),
    sb
      .from("call_logs")
      .select(
        "id, caller_number, duration_seconds, outcome, ai_summary, created_at",
      )
      .eq("organization_id", session.organizationId)
      .eq("caller_number", phoneE164)
      .limit(500),
    sb
      .from("action_tickets")
      .select(
        "id, status, summary, caller_number, engineering_priority, created_at",
      )
      .eq("organization_id", session.organizationId)
      .eq("caller_number", phoneE164)
      .limit(500),
  ]);

  if (appts.error || calls.error || tickets.error) {
    console.error("[gdpr] export query error", {
      a: appts.error?.message,
      c: calls.error?.message,
      t: tickets.error?.message,
    });
    return { ok: false, message: "Could not assemble export." };
  }

  // Audit — exporting customer PII is a sensitive, privacy-relevant
  // action even though it's the salon doing it for their own customer.
  try {
    const ctx = buildSecurityEventContext(await headers());
    await logSecurityEvent(ctx, {
      eventType: "gdpr_data_export",
      outcome: "success",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      metadata: {
        organization_id: session.organizationId,
        customer_phone_masked: maskPhoneE164(phoneE164),
        appointment_count: appts.data?.length ?? 0,
        call_log_count: calls.data?.length ?? 0,
        action_ticket_count: tickets.data?.length ?? 0,
      },
    });
  } catch (err) {
    console.warn("[gdpr] failed to record export event", err);
  }

  return {
    ok: true,
    phoneE164,
    data: {
      generated_at: new Date().toISOString(),
      organization_id: session.organizationId,
      customer_phone_e164: phoneE164,
      appointments: appts.data ?? [],
      call_logs: calls.data ?? [],
      action_tickets: tickets.data ?? [],
    },
  };
}

/**
 * Article 17 right to erasure. We anonymise rather than hard-delete
 * because the salon is required to keep appointment records for tax
 * purposes (Revenue: 6 years). The customer's name, phone and email are
 * replaced with redaction markers; the appointment time and price stay
 * for the books.
 *
 * Call transcripts already hold no personal data after our 30-day cron
 * sweep, but we proactively null `caller_number` and `ai_summary` for
 * any log row tied to the same phone so an erasure request takes effect
 * immediately.
 */
export async function eraseCustomerData(
  formData: FormData,
): Promise<GdprErasureResult> {
  const session = await requireDashboardSession();
  const phoneRaw = String(formData.get("phone") ?? "");
  const phoneE164 = normalizePhoneOrNull(phoneRaw);
  if (!phoneE164) {
    return {
      ok: false,
      message: "Enter a valid Irish (+353) or international mobile number.",
    };
  }
  const confirm = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (confirm !== "ERASE") {
    return {
      ok: false,
      message: "Type ERASE to confirm — this cannot be undone.",
    };
  }

  // Erasure mutates rows we don't always have UPDATE policy for under
  // RLS (e.g. call_logs is mostly read-only for tenant users), so we
  // use the admin client BUT scope every UPDATE to this org's rows.
  const admin = createAdminClient();

  const [apptsRes, callsRes, ticketsRes] = await Promise.all([
    admin
      .from("appointments")
      .update({
        customer_name: "Erased (GDPR)",
        customer_phone: erasedPhoneSentinel(),
        customer_email: null,
      })
      .eq("organization_id", session.organizationId)
      .eq("customer_phone", phoneE164)
      .select("id"),
    admin
      .from("call_logs")
      .update({
        caller_number: erasedPhoneSentinel(),
        transcript: null,
        transcript_review: null,
        ai_summary: null,
      })
      .eq("organization_id", session.organizationId)
      .eq("caller_number", phoneE164)
      .select("id"),
    admin
      .from("action_tickets")
      .update({
        summary: "[Erased on customer request — GDPR Art 17]",
        caller_number: erasedPhoneSentinel(),
      })
      .eq("organization_id", session.organizationId)
      .eq("caller_number", phoneE164)
      .select("id"),
  ]);

  if (apptsRes.error || callsRes.error || ticketsRes.error) {
    console.error("[gdpr] erasure error", {
      a: apptsRes.error?.message,
      c: callsRes.error?.message,
      t: ticketsRes.error?.message,
    });
    return { ok: false, message: "Erasure failed — please retry." };
  }

  const counts: GdprErasureCounts = {
    appointments_anonymised: apptsRes.data?.length ?? 0,
    call_logs_redacted: callsRes.data?.length ?? 0,
    action_tickets_redacted: ticketsRes.data?.length ?? 0,
  };

  try {
    const ctx = buildSecurityEventContext(await headers());
    await logSecurityEvent(ctx, {
      eventType: "gdpr_erasure",
      outcome: "success",
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      metadata: {
        organization_id: session.organizationId,
        customer_phone_masked: maskPhoneE164(phoneE164),
        ...counts,
      },
    });
  } catch (err) {
    console.warn("[gdpr] failed to record erasure event", err);
  }

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/calls");
  revalidatePath("/dashboard/bookings");

  return { ok: true, phoneE164, affected: counts };
}

// Sentinel used after erasure. Distinct per row would defeat the
// "this customer has been forgotten" lookup; using a single magic value
// means a re-export for the same phone number returns nothing.
function erasedPhoneSentinel(): string {
  return "+000000000000";
}

function maskPhoneE164(e164: string): string {
  if (e164.length <= 4) return "***";
  return `${e164.slice(0, 4)}***${e164.slice(-2)}`;
}
