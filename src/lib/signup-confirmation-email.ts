import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { createAdminClient } from "@/utils/supabase/admin";

export function signupConfirmationRedirectOrigin(): string {
  return resolveAppSiteOrigin()?.origin ?? "https://app.clistesystems.ie";
}

export function buildSignupConfirmationEmailBodies(
  actionLink: string,
  emailOtp?: string,
): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = emailOtp
    ? `${emailOtp} is your Cliste verification code`
    : "Confirm your Cliste account";
  const text = [
    "Thanks for signing up for Cliste.",
    "",
    ...(emailOtp
      ? [`Your verification code: ${emailOtp}`, "", "Or confirm via this link:"]
      : ["Confirm your email to continue setting up Cara:"]),
    actionLink,
    "",
    "This code and link expire after a while. If you did not create this account, you can ignore this email.",
  ].join("\n");

  const codeBlock = emailOtp
    ? `<p style="margin:0 0 8px;font-size:13px;color:#64748b;">Enter this code on the verification page:</p>
                <p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:0.35em;color:#0b1220;">${emailOtp}</p>`
    : "";

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
                ${codeBlock}
                <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#64748b;">
                  ${emailOtp ? "Or tap the button below to confirm in one click." : "Tap the button below to verify this inbox and continue setting up Cara."}
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${actionLink}" style="display:inline-block;background:#0b1220;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:999px;">
                    Confirm email and continue
                  </a>
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

  const linkType = input.password ? "signup" : "magiclink";
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
  if (linkError) {
    return {
      ok: false,
      message:
        linkError.message ??
        "Could not create a confirmation link. Check Supabase Auth redirect URLs.",
    };
  }

  // Build a clean first-party link straight to our callback page, which
  // verifies via token_hash + type. This avoids the long Supabase
  // /auth/v1/verify action link bouncing through a third-party domain.
  const hashedToken = linkData?.properties?.hashed_token?.trim();
  const fallbackActionLink = linkData?.properties?.action_link?.trim();
  const actionLink = hashedToken
    ? `${redirectTo}?token_hash=${encodeURIComponent(hashedToken)}&type=${linkType}`
    : fallbackActionLink;
  if (!actionLink) {
    return {
      ok: false,
      message:
        "Could not create a confirmation link. Check Supabase Auth redirect URLs.",
    };
  }

  // 6-digit code for the same token — lets the user type it on the
  // check-email page instead of opening the link.
  const emailOtp = linkData?.properties?.email_otp?.trim() || undefined;

  const bodies = buildSignupConfirmationEmailBodies(actionLink, emailOtp);
  return sendTransactionalEmail({
    to: email,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html,
  });
}
