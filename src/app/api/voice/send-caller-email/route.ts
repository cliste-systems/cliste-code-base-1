import { NextResponse } from "next/server";

import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";
import {
  authorizeVoiceWebhook,
  voiceWebhookNoSecretResponse,
  voiceWebhookUnauthorizedResponse,
} from "@/lib/voice-webhook-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_EMAIL_BODY_LENGTH = 8000;

type SendCallerEmailBody = {
  called_number?: string;
  to: string;
  subject: string;
  body: string;
  /** Required in production — Cara must ask on the call before emailing. */
  caller_consented?: boolean;
};

function requireCallerConsent(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Voice worker: email a caller-facing message (e.g. directions / maps link).
 */
export async function POST(request: Request) {
  const auth = await authorizeVoiceWebhook(request);
  if (auth === "no_secret") return voiceWebhookNoSecretResponse();
  if (auth === "bad") return voiceWebhookUnauthorizedResponse();

  if (!isSendGridConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Email is not configured on this server" },
      { status: 503 },
    );
  }

  let body: SendCallerEmailBody;
  try {
    body = (await request.json()) as SendCallerEmailBody;
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

  const to = String(body.to ?? "").trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { ok: false, error: "A valid to email is required" },
      { status: 400 },
    );
  }

  const subject = String(body.subject ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!subject || !text) {
    return NextResponse.json(
      { ok: false, error: "subject and body are required" },
      { status: 400 },
    );
  }
  if (text.length > MAX_EMAIL_BODY_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `body exceeds ${MAX_EMAIL_BODY_LENGTH} characters`,
      },
      { status: 400 },
    );
  }
  if (requireCallerConsent() && body.caller_consented !== true) {
    return NextResponse.json(
      {
        ok: false,
        code: "caller_consent_required",
        error:
          "caller_consented must be true — Cara must ask on the call before emailing",
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
    console.error("[voice/send-caller-email] phone lookup", phoneErr);
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

  const businessName = String(orgRow?.name ?? "").trim() || "Your business";
  const mail = await sendTransactionalEmail({
    to,
    subject: subject.includes(businessName) ? subject : `${businessName}: ${subject}`,
    text,
  });

  if (!mail.ok) {
    return NextResponse.json(
      { ok: false, code: "send_failed", error: mail.message },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, to });
}
