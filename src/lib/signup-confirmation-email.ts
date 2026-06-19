import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { SIGNUP_EMAIL_OTP_PATTERN } from "@/lib/signup-email-otp";
import { buildTransactionalEmailHtml } from "@/lib/transactional-email-layout";
import { createAdminClient } from "@/utils/supabase/admin";

export function signupConfirmationRedirectOrigin(): string {
  return resolveAppSiteOrigin()?.origin ?? "https://app.clistesystems.ie";
}

export function signupConfirmationLogoUrl(): string {
  return `${signupConfirmationRedirectOrigin()}${PUBLIC_ASSETS.logo}`;
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
    ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">Enter this code on the verification page:</p>
                <p style="margin:0 0 24px;font-size:28px;font-weight:700;letter-spacing:0.28em;line-height:1.2;color:#0b1220;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${emailOtp}</p>`
    : "";

  const html = buildTransactionalEmailHtml({
    subject,
    logoUrl: signupConfirmationLogoUrl(),
    headline: "Confirm your email",
    extraHtml: codeBlock,
    bodyHtml: emailOtp
      ? "Or tap the button below to confirm in one click."
      : "Tap the button below to verify this inbox and continue setting up Cara.",
    ctaLabel: "Confirm email and continue",
    ctaHref: actionLink,
    footerHtml: "If you did not create this account, you can ignore this email.",
  });

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

  const emailOtp = linkData?.properties?.email_otp?.trim();
  if (!emailOtp || !SIGNUP_EMAIL_OTP_PATTERN.test(emailOtp)) {
    return {
      ok: false,
      message: "Could not create a verification code. Please try again.",
    };
  }

  const bodies = buildSignupConfirmationEmailBodies(actionLink, emailOtp);
  return sendTransactionalEmail({
    to: email,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html,
  });
}
