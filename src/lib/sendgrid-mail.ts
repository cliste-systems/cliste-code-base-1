/**
 * Transactional email via SendGrid HTTP API (v3).
 *
 * **Salon owner invites** (`inviteUserByEmail`) are sent by **Supabase Auth**, not
 * this module. To use SendGrid for those, set custom SMTP in the Supabase dashboard:
 * Project → Authentication → Emails → SMTP: host `smtp.sendgrid.net`, port `587`,
 * username `apikey`, password = your SendGrid API key, sender = verified address.
 *
 * Use this helper for **application-sent** mail (reminders, notifications, etc.).
 *
 * Env (Vercel / `.env.local`):
 * - `SENDGRID_API_KEY` — API key with Mail Send permission
 * - `SENDGRID_FROM_EMAIL` — verified sender (Single Sender or domain auth)
 * - `SENDGRID_FROM_NAME` — optional display name
 */

export function isSendGridConfigured(): boolean {
  return Boolean(
    process.env.SENDGRID_API_KEY?.trim() &&
      process.env.SENDGRID_FROM_EMAIL?.trim(),
  );
}

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendTransactionalEmailResult =
  | { ok: true }
  | { ok: false; message: string };

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
  const fromName = process.env.SENDGRID_FROM_NAME?.trim() || "Cliste";

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

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: body,
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

  return {
    ok: false,
    message: `SendGrid error (${res.status}): ${detail}`,
  };
}
