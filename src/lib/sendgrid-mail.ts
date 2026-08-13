/**
 * Transactional email via SendGrid HTTP API (v3).
 *
 * Signup confirmation, team invites, and salon owner invites are sent through
 * this module (branded HTML + first-party auth links). Configure
 * `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` in production.
 *
 * Env (Vercel / `.env.local`):
 * - `SENDGRID_API_KEY` — API key with Mail Send permission
 * - `SENDGRID_FROM_EMAIL` — verified sender (Single Sender or domain auth)
 * - `SENDGRID_FROM_NAME` — optional display name
 * - `SENDGRID_API_URL` — optional; defaults to global API. Use
 *   `https://api.eu.sendgrid.com` only with an EU-designated SendGrid subuser.
 */

import { PRODUCT_NAME } from "@/lib/company-details";

export function isSendGridConfigured(): boolean {
  return Boolean(
    process.env.SENDGRID_API_KEY?.trim() &&
      process.env.SENDGRID_FROM_EMAIL?.trim(),
  );
}

export type EmailAddress = {
  email: string;
  name?: string;
};

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Override platform From (e.g. per-business `{slug}@clistesystems.ie`). */
  from?: EmailAddress;
  replyTo?: EmailAddress;
};

export type SendTransactionalEmailResult =
  | { ok: true }
  | { ok: false; message: string };

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const platformFromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
  const platformFromName = process.env.SENDGRID_FROM_NAME?.trim() || PRODUCT_NAME;
  const fromEmail = input.from?.email.trim() || platformFromEmail;
  const fromName = input.from?.name?.trim() || platformFromName;

  if (!apiKey) {
    return { ok: false, message: "SENDGRID_API_KEY is not configured." };
  }
  if (!fromEmail) {
    return { ok: false, message: "SENDGRID_FROM_EMAIL is not configured." };
  }

  const to = input.to.trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, message: "Invalid recipient email." };
  }

  const subject = input.subject.trim();
  if (!subject) {
    return { ok: false, message: "Subject is required." };
  }

  const body = [
    {
      type: "text/plain",
      value: input.text,
    },
    ...(input.html
      ? [{ type: "text/html", value: input.html } as const]
      : []),
  ];

  const apiBase =
    process.env.SENDGRID_API_URL?.trim().replace(/\/$/, "") ||
    "https://api.sendgrid.com";

  const res = await fetch(`${apiBase}/v3/mail/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      ...(input.replyTo?.email.trim()
        ? {
            reply_to: {
              email: input.replyTo.email.trim(),
              ...(input.replyTo.name?.trim()
                ? { name: input.replyTo.name.trim() }
                : {}),
            },
          }
        : {}),
      subject,
      content: body,
      // Click tracking rewrites links through a SendGrid tracking domain
      // (url####.hellocara.ie) which we don't have DNS for, breaking
      // auth links. These are transactional emails — no tracking needed.
      tracking_settings: {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false },
      },
    }),
  });

  if (res.status >= 200 && res.status < 300) {
    return { ok: true };
  }

  let detail = res.statusText;
  try {
    const j = (await res.json()) as { errors?: { message?: string }[] };
    if (Array.isArray(j.errors) && j.errors[0]?.message) {
      detail = j.errors.map((e) => e.message).join("; ");
    }
  } catch {
    /* ignore */
  }

  const detailLower = detail.toLowerCase();
  if (
    detailLower.includes("maximum credits exceeded") ||
    detailLower.includes("credit") && detailLower.includes("exceed")
  ) {
    return {
      ok: false,
      message:
        "Email sending limit reached on SendGrid. Check your SendGrid plan or wait for credits to reset, then try again.",
    };
  }

  return {
    ok: false,
    message: `SendGrid error (${res.status}): ${detail}`,
  };
}
