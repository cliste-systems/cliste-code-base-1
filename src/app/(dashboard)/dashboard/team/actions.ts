"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { resolveAppSiteOrigin } from "@/lib/booking-site-origin";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { createAdminClient } from "@/utils/supabase/admin";

export type TeamActionResult = { ok: true } | { ok: false; message: string };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function inviteTeamMember(
  _prev: TeamActionResult,
  formData: FormData,
): Promise<TeamActionResult> {
  const session = await requireDashboardAdmin();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "member");

  if (!email || !email.includes("@")) {
    return { ok: false, message: "Enter a valid email address." };
  }

  if (role !== "member" && role !== "admin") {
    return { ok: false, message: "Invalid role." };
  }

  const admin = createAdminClient();
  const appOrigin =
    resolveAppSiteOrigin()?.origin ??
    (await headers()).get("origin") ??
    "http://localhost:3001";
  const inviteRedirectTo = `${appOrigin}/auth/callback?next=/dashboard/set-password`;

  const { data: authData, error: authError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteRedirectTo,
      data: {
        full_name: name || undefined,
        needs_password: true,
      },
    });

  if (authError || !authData.user?.id) {
    return {
      ok: false,
      message:
        authError?.message ??
        "Could not send invite. Check the email address and try again.",
    };
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("account_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (existing?.account_id && existing.account_id !== session.accountId) {
    return {
      ok: false,
      message: "This email is already linked to another business.",
    };
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: authData.user.id,
      account_id: session.accountId,
      organization_id: session.organizationId,
      active_organization_id: session.organizationId,
      role,
      name: name || null,
    },
    { onConflict: "id" },
  );

  if (!profileError) {
    await admin.from("account_memberships").upsert(
      {
        user_id: authData.user.id,
        account_id: session.accountId,
        role,
      },
      { onConflict: "user_id,account_id" },
    );
  }

  if (profileError) {
    return { ok: false, message: profileError.message };
  }

  const ctx = buildSecurityEventContext(await headers());
  await logSecurityEvent(ctx, {
    eventType: "team_member_invited",
    outcome: "success",
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    targetUserId: authData.user.id,
    targetEmail: email,
    metadata: { role },
  });

  revalidatePath(DASHBOARD_ROUTES.team);
  return { ok: true };
}

export async function removeTeamMemberAction(
  formData: FormData,
): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  await removeTeamMember(userId);
}

export async function removeTeamMember(
  userId: string,
): Promise<TeamActionResult> {
  const session = await requireDashboardAdmin();
  const trimmed = userId.trim();
  if (!trimmed) return { ok: false, message: "Invalid member." };
  if (trimmed === session.user.id) {
    return { ok: false, message: "You cannot remove yourself." };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, account_id, role")
    .eq("id", trimmed)
    .maybeSingle();

  if (!profile || profile.account_id !== session.accountId) {
    return { ok: false, message: "Team member not found." };
  }

  if (profile.role === "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("account_id", session.accountId)
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { ok: false, message: "You need at least one owner on the team." };
    }
  }

  const { error } = await admin.from("profiles").delete().eq("id", trimmed);
  if (error) return { ok: false, message: error.message };

  await admin
    .from("account_memberships")
    .delete()
    .eq("user_id", trimmed)
    .eq("account_id", session.accountId);

  revalidatePath(DASHBOARD_ROUTES.team);
  return { ok: true };
}
