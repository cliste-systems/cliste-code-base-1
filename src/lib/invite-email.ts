import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { buildInviteEmailBodies } from "@/lib/invite-email-bodies";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { isSendGridConfigured, sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { createAdminClient } from "@/utils/supabase/admin";

export { buildInviteEmailBodies } from "@/lib/invite-email-bodies";

export function inviteEmailRedirectOrigin(): string {
  return resolveAppSiteOrigin()?.origin ?? "https://app.clistesystems.ie";
}

export function inviteEmailLogoUrl(): string {
  return `${inviteEmailRedirectOrigin()}${PUBLIC_ASSETS.logo}`;
}

export type SendInviteEmailInput = {
  email: string;
  recipientName?: string;
  businessName: string;
  productName: string;
  /** Defaults to `/auth/callback` on the app origin. */
  redirectTo?: string;
  admin?: SupabaseClient;
};

export type SendInviteEmailResult =
  | { ok: true; userId: string }
  | { ok: false; message: string };

function isEmailAlreadyRegisteredError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already exists")
  );
}

export async function sendInviteEmail(
  input: SendInviteEmailInput,
): Promise<SendInviteEmailResult> {
  if (!isSendGridConfigured()) {
    return {
      ok: false,
      message: "Email is not configured yet. Please try again later.",
    };
  }

  const email = input.email.trim().toLowerCase();
  const redirectTo =
    input.redirectTo?.trim() ||
    `${inviteEmailRedirectOrigin()}/auth/callback`;

  let admin = input.admin;
  try {
    admin ??= createAdminClient();
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Backend unavailable.",
    };
  }

  const recipientName = input.recipientName?.trim() || undefined;
  const userMetadata = {
    full_name: recipientName,
    needs_password: true,
  };

  let linkType: "invite" | "magiclink" = "invite";
  let createdNewAuthUser = false;

  let { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: userMetadata,
      },
    });

  if (linkError && isEmailAlreadyRegisteredError(linkError.message)) {
    ({ data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo,
          data: userMetadata,
        },
      }));
    linkType = "magiclink";
  } else if (!linkError) {
    createdNewAuthUser = true;
  }

  if (linkError) {
    return {
      ok: false,
      message:
        linkError.message ??
        "Could not create an invite link. Check Supabase Auth redirect URLs.",
    };
  }

  const userId = linkData?.user?.id?.trim();
  if (!userId) {
    return {
      ok: false,
      message: "Could not create an invite for this email address.",
    };
  }

  if (linkType === "magiclink") {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(linkData.user?.user_metadata ?? {}),
        ...userMetadata,
      },
    });
  }

  const hashedToken = linkData?.properties?.hashed_token?.trim();
  const fallbackActionLink = linkData?.properties?.action_link?.trim();
  const actionLink = hashedToken
    ? `${redirectTo}?token_hash=${encodeURIComponent(hashedToken)}&type=${linkType}`
    : fallbackActionLink;

  if (!actionLink) {
    return {
      ok: false,
      message:
        "Could not create an invite link. Check Supabase Auth redirect URLs.",
    };
  }

  const bodies = buildInviteEmailBodies({
    actionLink,
    recipientName,
    businessName: input.businessName,
    productName: input.productName,
    logoUrl: inviteEmailLogoUrl(),
  });

  const sent = await sendTransactionalEmail({
    to: email,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html,
  });

  if (!sent.ok) {
    if (createdNewAuthUser) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        /* best effort rollback */
      }
    }
    return sent;
  }

  return { ok: true, userId };
}
