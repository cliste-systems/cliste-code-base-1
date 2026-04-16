"use server";

import type { User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

import { requireAdminSessionUser } from "@/lib/admin-session";
import {
  purchasePhoneNumbers,
  searchAvailableUsPhoneNumbers,
} from "@/lib/livekit-phone-numbers";
import {
  createSupportDashboardCookieValue,
  SUPPORT_DASHBOARD_COOKIE,
  supportDashboardCookieOptions,
} from "@/lib/support-dashboard-cookie";
import { geocodeIrelandLocation } from "@/lib/geocode-ireland";
import {
  type OrganizationNiche,
  isOrganizationNiche,
} from "@/lib/organization-niche";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { createAdminClient } from "@/utils/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function assertAdminOperator(): Promise<User> {
  return requireAdminSessionUser();
}

function parseRefererOrigin(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
  } catch {
    /* ignore */
  }
  return null;
}

function headerDerivedOrigin(headerList: Headers): string | null {
  const forwardedHost = headerList.get("x-forwarded-host")?.split(",")[0]?.trim();
  const rawHost = forwardedHost ?? headerList.get("host");
  if (!rawHost) return null;
  const rawProto =
    headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  const proto = rawProto.toLowerCase() === "https" ? "https" : "http";
  return `${proto}://${rawHost}`;
}

function normalizeClientOrigin(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

function normalizeConfiguredOrigin(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim().replace(/\/$/, "");
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin;
    }
  } catch {
    // Allow host-only env values (e.g. my-app.vercel.app).
    if (/^[a-z0-9.-]+$/i.test(value)) {
      return `https://${value}`;
    }
  }
  return null;
}

function isDevLocalOrLanHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname === "[::1]" || hostname === "::1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const m = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

/**
 * Origin embedded in magic-link `redirect_to`. Must match how the browser
 * actually reaches this app, or Supabase redirects to a dead host
 * (ERR_CONNECTION_REFUSED).
 *
 * `clientOrigin` comes from `window.location.origin` so LAN / 127.0.0.1 /
 * hostname variants match even when Referer is missing (e.g. some Server
 * Action requests). It is only trusted when it matches Referer or Host, or
 * in development when it is a local/LAN URL.
 */
async function getAppOriginForRedirect(
  clientOrigin?: string | null
): Promise<string> {
  const explicit = normalizeConfiguredOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit;

  const vercelProduction = normalizeConfiguredOrigin(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  );
  if (vercelProduction) return vercelProduction;

  const vercelPreview = normalizeConfiguredOrigin(process.env.VERCEL_URL);
  if (vercelPreview) return vercelPreview;

  const h = await headers();
  const refererOrigin = parseRefererOrigin(h.get("referer"));
  const headerOrigin = headerDerivedOrigin(h);
  const hint = normalizeClientOrigin(clientOrigin);

  if (hint) {
    if (refererOrigin && hint === refererOrigin) return hint;
    if (headerOrigin && hint === headerOrigin) return hint;
    if (process.env.NODE_ENV === "development") {
      try {
        const { hostname } = new URL(hint);
        if (isDevLocalOrLanHostname(hostname)) return hint;
      } catch {
        /* ignore */
      }
    }
  }

  if (refererOrigin) return refererOrigin;
  if (headerOrigin) return headerOrigin;
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return "https://app.clistesystems.ie";
}

export type CreateOrganizationResult =
  | { ok: true }
  | { ok: false; message: string };

function formatAuthError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("rate limit") ||
    m.includes("too many emails") ||
    m.includes("email rate limit")
  ) {
    return (
      "Email rate limit exceeded. Supabase's built-in email service only allows a handful of messages per hour. " +
      "Wait and try again, or connect custom SMTP under Supabase → Authentication → Emails → SMTP Settings " +
      "(e.g. Resend, SendGrid, or Amazon SES) for production volume."
    );
  }
  if (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already exists") ||
    m.includes("duplicate")
  ) {
    return "An account with this email already exists. Use a different owner email or reset the user in Supabase Auth.";
  }
  return message;
}

export async function createOrganization(payload: {
  name: string;
  slug: string;
  tier: "connect" | "native";
  ownerEmail: string;
  ownerName: string;
  niche?: OrganizationNiche;
  /** Optional; shown on the public book directory and used for distance search */
  address?: string | null;
  /** Optional; geocoded with address via OpenStreetMap Nominatim (Ireland) */
  storefrontEircode?: string | null;
  /** From `window.location.origin` so invite redirect matches this app */
  clientOrigin?: string | null;
}): Promise<CreateOrganizationResult> {
  await assertAdminOperator();
  const name = payload.name.trim();
  const slug = payload.slug.trim().toLowerCase();
  const tier = payload.tier;
  const ownerEmail = payload.ownerEmail.trim().toLowerCase();
  const ownerName = payload.ownerName.trim();

  if (!name || !slug) {
    return { ok: false, message: "Name and slug are required." };
  }

  if (!ownerName) {
    return { ok: false, message: "Salon owner name is required." };
  }

  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return { ok: false, message: "A valid owner email is required." };
  }

  if (tier !== "connect" && tier !== "native") {
    return { ok: false, message: "Invalid tier." };
  }

  const niche: OrganizationNiche =
    payload.niche && isOrganizationNiche(payload.niche)
      ? payload.niche
      : "hair_salon";

  const addressTrim = (payload.address ?? "").trim();
  const eircodeTrim = (payload.storefrontEircode ?? "").trim();
  let mapLat: number | null = null;
  let mapLng: number | null = null;
  const geoQuery = [addressTrim, eircodeTrim].filter(Boolean).join(", ");
  if (geoQuery) {
    const g = await geocodeIrelandLocation(geoQuery);
    if (g) {
      mapLat = g.lat;
      mapLng = g.lng;
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  let organizationId: string | null = null;
  let userId: string | null = null;

  try {
    const { data: orgRow, error: orgError } = await admin
      .from("organizations")
      .insert({
        name,
        slug,
        tier,
        niche,
        is_active: true,
        address: addressTrim || null,
        storefront_eircode: eircodeTrim || null,
        storefront_map_lat: mapLat,
        storefront_map_lng: mapLng,
      })
      .select("id")
      .single();

    if (orgError || !orgRow?.id) {
      return {
        ok: false,
        message: orgError?.message ?? "Could not create organization.",
      };
    }

    organizationId = orgRow.id;

    const appOrigin = await getAppOriginForRedirect(payload.clientOrigin);
    const inviteRedirectTo = `${appOrigin}/auth/callback`;

    const { data: authData, error: authError } =
      await admin.auth.admin.inviteUserByEmail(ownerEmail, {
        redirectTo: inviteRedirectTo,
        data: {
          full_name: ownerName,
          needs_password: true,
        },
      });

    if (authError || !authData.user?.id) {
      await admin.from("organizations").delete().eq("id", organizationId);
      return {
        ok: false,
        message: formatAuthError(
          authError?.message ??
            "Could not send invite. Check Supabase Auth email settings and redirect URLs."
        ),
      };
    }

    userId = authData.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      organization_id: organizationId,
      role: "admin",
      name: ownerName,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      await admin.from("organizations").delete().eq("id", organizationId);
      return {
        ok: false,
        message: `Profile could not be created: ${profileError.message}`,
      };
    }

    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    if (userId) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        /* best effort */
      }
    }
    if (organizationId) {
      try {
        await admin.from("organizations").delete().eq("id", organizationId);
      } catch {
        /* best effort */
      }
    }
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Provisioning failed. No changes were kept.",
    };
  }
}

export type UpdateOrganizationNicheResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateOrganizationNiche(
  organizationId: string,
  niche: string,
): Promise<UpdateOrganizationNicheResult> {
  await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }
  if (!isOrganizationNiche(niche)) {
    return { ok: false, message: "Invalid niche." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { error } = await admin
    .from("organizations")
    .update({
      niche,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/admin/organizations/${id}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export type DeleteOrganizationResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Removes a tenant: deletes every auth user in the org (profiles cascade),
 * then deletes the organization row (call_logs, services, tickets cascade).
 */
export async function deleteOrganization(
  organizationId: string
): Promise<DeleteOrganizationResult> {
  await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  try {
    const { data: members, error: listError } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", id);

    if (listError) {
      return { ok: false, message: listError.message };
    }

    for (const row of members ?? []) {
      const { error: delUserError } = await admin.auth.admin.deleteUser(
        row.id
      );
      if (delUserError) {
        return {
          ok: false,
          message: `Could not remove a user (${row.id}): ${delUserError.message}`,
        };
      }
    }

    const { error: orgDelError } = await admin
      .from("organizations")
      .delete()
      .eq("id", id);

    if (orgDelError) {
      return { ok: false, message: orgDelError.message };
    }

    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Failed to delete organization.",
    };
  }
}

export type SupportDashboardLinkResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

/** Generates a sign-in link so support can open the salon dashboard as a member. */
export async function createSupportDashboardLink(
  organizationId: string,
  clientOrigin?: string | null
): Promise<SupportDashboardLinkResult> {
  await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data: rows, error: listError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("organization_id", id);

  if (listError) {
    return { ok: false, message: listError.message };
  }
  if (!rows?.length) {
    return {
      ok: false,
      message: "This organization has no members to sign in as.",
    };
  }

  const target =
    rows.find((r) => r.role === "admin") ??
    rows.find((r) => r.role === "member") ??
    rows[0];

  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(target.id);

  if (userError || !userData.user) {
    return {
      ok: false,
      message: userError?.message ?? "Could not load that user from Auth.",
    };
  }

  const email = userData.user.email?.trim();
  if (!email) {
    return {
      ok: false,
      message:
        "This account has no email (e.g. phone-only). Sign-in links require an email identity.",
    };
  }

  const origin = await getAppOriginForRedirect(clientOrigin);
  const redirectTo = `${origin}/auth/callback`;

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

  if (linkError || !linkData?.properties?.action_link) {
    return {
      ok: false,
      message: linkError?.message
        ? formatAuthError(linkError.message)
        : "Could not generate a sign-in link. Check Supabase Auth settings and redirect URL allowlist.",
    };
  }

  const supportCookieValue = await createSupportDashboardCookieValue();
  if (supportCookieValue) {
    (await cookies()).set(
      SUPPORT_DASHBOARD_COOKIE,
      supportCookieValue,
      supportDashboardCookieOptions()
    );
  }

  return { ok: true, url: linkData.properties.action_link };
}

export type AdminRecoveryLinkResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

/**
 * Generates a password recovery link (admin copies to user). Does not send email from this app.
 */
export async function adminSendPasswordRecoveryLink(
  userId: string,
  userEmail: string,
  clientOrigin?: string | null
): Promise<AdminRecoveryLinkResult> {
  await assertAdminOperator();
  const id = userId.trim();
  const email = userEmail.trim().toLowerCase();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid user id." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "A valid email is required." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(id);
  if (userError || !userData.user) {
    return {
      ok: false,
      message: userError?.message ?? "User not found.",
    };
  }
  const authEmail = userData.user.email?.trim().toLowerCase();
  if (authEmail !== email) {
    return { ok: false, message: "Email does not match this auth user." };
  }

  const origin = await getAppOriginForRedirect(clientOrigin);
  const redirectTo = `${origin}/auth/callback`;

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

  if (linkError || !linkData?.properties?.action_link) {
    return {
      ok: false,
      message: linkError?.message
        ? formatAuthError(linkError.message)
        : "Could not generate recovery link. Check Supabase Auth redirect URL allowlist.",
    };
  }

  return { ok: true, url: linkData.properties.action_link };
}

export type AdminSuspendUserResult = { ok: true } | { ok: false; message: string };

export type AdminConsoleAccessResult =
  | { ok: true }
  | { ok: false; message: string };

async function setAdminConsoleAccess(
  userId: string,
  enabled: boolean
): Promise<AdminConsoleAccessResult> {
  const actor = await assertAdminOperator();
  const id = userId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid user id." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data: userData, error: loadError } =
    await admin.auth.admin.getUserById(id);
  if (loadError || !userData.user) {
    return { ok: false, message: loadError?.message ?? "User not found." };
  }

  const appMeta = (userData.user.app_metadata ?? {}) as Record<string, unknown>;
  const nextAppMeta: Record<string, unknown> = {
    ...appMeta,
    cliste_admin_console: enabled,
  };

  const { error: updateError } = await admin.auth.admin.updateUserById(id, {
    app_metadata: nextAppMeta,
  });
  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  console.info("[security] admin_console_access_updated", {
    actorUserId: actor.id,
    actorEmail: actor.email?.trim().toLowerCase() ?? null,
    targetUserId: id,
    targetEmail: userData.user.email?.trim().toLowerCase() ?? null,
    enabled,
  });
  const h = await headers();
  await logSecurityEvent(buildSecurityEventContext(h), {
    eventType: "admin_console_access_updated",
    outcome: "success",
    actorUserId: actor.id,
    actorEmail: actor.email ?? null,
    targetUserId: id,
    targetEmail: userData.user.email ?? null,
    metadata: { enabled },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function adminGrantConsoleAccess(
  userId: string
): Promise<AdminConsoleAccessResult> {
  return setAdminConsoleAccess(userId, true);
}

export async function adminRevokeConsoleAccess(
  userId: string
): Promise<AdminConsoleAccessResult> {
  return setAdminConsoleAccess(userId, false);
}

/** Long-lived ban (~100y). Lift with adminUnsuspendUser. */
export async function adminSuspendUser(
  userId: string
): Promise<AdminSuspendUserResult> {
  await assertAdminOperator();
  const id = userId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid user id." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: "876600h",
  });
  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function adminUnsuspendUser(
  userId: string
): Promise<AdminSuspendUserResult> {
  await assertAdminOperator();
  const id = userId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid user id." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: "none",
  });
  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export type AdminCloseSupportTicketResult =
  | { ok: true }
  | { ok: false; message: string };

export async function adminCloseSupportTicket(
  ticketId: string
): Promise<AdminCloseSupportTicketResult> {
  await assertAdminOperator();
  const id = ticketId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid ticket id." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { error } = await admin
    .from("support_tickets")
    .update({
      status: "closed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${id}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard/support");
  return { ok: true };
}

const MAX_SUPPORT_REPLY = 8000;

export type AdminReplySupportTicketResult =
  | { ok: true }
  | { ok: false; message: string };

export async function adminReplyToSupportTicket(
  ticketId: string,
  body: string
): Promise<AdminReplySupportTicketResult> {
  await assertAdminOperator();
  const id = ticketId.trim();
  const text = body.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid ticket id." };
  }
  if (!text) {
    return { ok: false, message: "Please enter a reply." };
  }
  if (text.length > MAX_SUPPORT_REPLY) {
    return {
      ok: false,
      message: `Reply must be at most ${MAX_SUPPORT_REPLY} characters.`,
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data: ticket, error: loadErr } = await admin
    .from("support_tickets")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !ticket) {
    return { ok: false, message: loadErr?.message ?? "Ticket not found." };
  }

  const { error } = await admin.from("support_ticket_messages").insert({
    ticket_id: id,
    author_kind: "admin",
    body: text,
    created_by: null,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await admin
    .from("support_tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${id}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard/support");
  return { ok: true };
}

export type UpdateTenantAIConfigResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateTenantAIConfig(
  organizationId: string,
  formData: FormData
): Promise<UpdateTenantAIConfigResult> {
  await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  const greeting = String(formData.get("greeting") ?? "").trim();
  const custom_prompt = String(formData.get("custom_prompt") ?? "").trim();

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data, error } = await admin
    .from("organizations")
    .update({
      greeting: greeting || null,
      custom_prompt: custom_prompt || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data?.length) {
    return {
      ok: false,
      message:
        "No row was updated (organization may be missing or id mismatch).",
    };
  }

  revalidatePath(`/admin/organizations/${id}`);
  revalidatePath("/admin");
  return { ok: true };
}

export type AssignLivekitUsPhoneResult =
  | { ok: true; e164: string }
  | { ok: false; message: string };

/**
 * Search LiveKit US inventory, purchase the first available number, save E.164
 * to `organizations.phone_number` for the voice agent / routing.
 *
 * Env: LIVEKIT_URL (wss or https), LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
 * Optional: LIVEKIT_SIP_DISPATCH_RULE_ID — links the number to your inbound SIP rule in Cloud.
 */
export async function assignLivekitUsPhoneToOrganization(
  organizationId: string
): Promise<AssignLivekitUsPhoneResult> {
  await assertAdminOperator();
  const id = organizationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Invalid organization id." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Admin client unavailable.",
    };
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, phone_number")
    .eq("id", id)
    .maybeSingle();

  if (orgErr || !org) {
    return { ok: false, message: orgErr?.message ?? "Organization not found." };
  }
  if (org.phone_number?.trim()) {
    return {
      ok: false,
      message:
        "This salon already has a phone number. Remove or change it in Supabase before assigning another LiveKit number (release the old number in LiveKit Cloud if it is no longer needed).",
    };
  }

  let available: string[];
  try {
    available = await searchAvailableUsPhoneNumbers(25);
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? `LiveKit search failed: ${e.message}`
          : "LiveKit search failed. Check LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in .env.local.",
    };
  }

  if (available.length === 0) {
    return {
      ok: false,
      message:
        "No US numbers available from LiveKit right now. Check telephony is enabled and quotas in LiveKit Cloud.",
    };
  }

  const pick = available[0]!;
  const dispatchId = process.env.LIVEKIT_SIP_DISPATCH_RULE_ID?.trim() || null;

  let purchased: string[];
  try {
    purchased = await purchasePhoneNumbers([pick], dispatchId);
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? `LiveKit purchase failed: ${e.message}`
          : "LiveKit purchase failed.",
    };
  }

  const e164 = purchased[0] ?? pick;

  const { error: upErr } = await admin
    .from("organizations")
    .update({
      phone_number: e164,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (upErr) {
    return {
      ok: false,
      message: `Number ${e164} was purchased but could not be saved: ${upErr.message}`,
    };
  }

  revalidatePath(`/admin/organizations/${id}`);
  revalidatePath("/admin");
  return { ok: true, e164 };
}

export type TestSendGridResult = { ok: true } | { ok: false; message: string };

/**
 * Sends one transactional test email to the signed-in admin (SendGrid v3).
 * Requires SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.
 */
export async function testSendGridConnection(): Promise<TestSendGridResult> {
  const user = await assertAdminOperator();
  const email = user.email?.trim();
  if (!email) {
    return { ok: false, message: "Your account has no email address." };
  }

  const result = await sendTransactionalEmail({
    to: email,
    subject: "Cliste: SendGrid test",
    text: "If you received this, SendGrid is connected to the Cliste app.",
    html: "<p>If you received this, SendGrid is connected to the Cliste app.</p>",
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true };
}
