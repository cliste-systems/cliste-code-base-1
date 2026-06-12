import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { createAdminClient } from "@/utils/supabase/admin";

export function signupConfirmationRedirectOrigin(): string {
  return resolveAppSiteOrigin()?.origin ?? "https://app.clistesystems.ie";
}

export function buildSignupConfirmationEmailBodies(actionLink: string): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Confirm your Cliste account";
  const text = [
    "Thanks for signing up for Cliste.",
    "",
    "Confirm your email to continue setting up Cara:",
    actionLink,
    "",
    "This link expires after a while. If you did not create this account, you can ignore this email.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0b1220;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px 28px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">Cliste</p>
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:600;">Confirm your email</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
                  Thanks for signing up. Tap the button below to verify this inbox and continue setting up Cara.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${actionLink}" style="display:inline-block;background:#0b1220;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:999px;">
                    Confirm email and continue
                  </a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  Or copy this link into your browser:<br />
                  <a href="${actionLink}" style="color:#0b1220;word-break:break-all;">${actionLink}</a>
                </p>
                <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  If you did not create this account, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

type SendSignupConfirmationInput = {
  email: string;
  /** Required on first signup; optional when resending to an existing account. */
  password?: string;
  admin?: SupabaseClient;
};

export async function sendSignupConfirmationEmail(
  input: SendSignupConfirmationInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSendGridConfigured()) {
    return {
      ok: false,
      message: "Email is not configured yet. Please try again later.",
    };
  }

  const email = input.email.trim().toLowerCase();
  const redirectTo = `${signupConfirmationRedirectOrigin()}/auth/callback`;

  let admin = input.admin;
  try {
    admin ??= createAdminClient();
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Backend unavailable.",
    };
  }

  const { data: linkData, error: linkError } = input.password
    ? await admin.auth.admin.generateLink({
        type: "signup",
        email,
        password: input.password,
        options: { redirectTo },
      })
    : await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
  const actionLink = linkData?.properties?.action_link?.trim();
  if (linkError || !actionLink) {
    return {
      ok: false,
      message:
        linkError?.message ??
        "Could not create a confirmation link. Check Supabase Auth redirect URLs.",
    };
  }

  const bodies = buildSignupConfirmationEmailBodies(actionLink);
  return sendTransactionalEmail({
    to: email,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html,
  });
}
