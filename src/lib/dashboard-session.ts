import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { redirectIfEmailUnconfirmed } from "@/lib/require-email-confirmed";
import { isLocalDashboardPreviewEnabled, supabaseServiceRoleLooksConfigured } from "@/lib/dashboard-dev";
import {
  createOfflinePreviewSupabase,
  OFFLINE_PREVIEW_ACCOUNT_ID,
  OFFLINE_PREVIEW_ORG_ID,
  OFFLINE_PREVIEW_PROFILE_ID,
} from "@/lib/dashboard-offline-preview";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export type DashboardSessionProfile = {
  name: string | null;
  role: string | null;
  avatarUrl: string | null;
};

export type DashboardSession = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  accountId: string;
  organizationId: string;
  /**
   * The caller's row from `public.profiles`. Loaded as part of the same
   * round-trip as `organization_id` so callers (e.g. the dashboard layout)
   * don't have to issue a second query for the user's display name/role.
   */
  profile: DashboardSessionProfile;
  /** Dev-only — no Supabase auth cookie; uses a real org from the database. */
  isLocalPreview?: boolean;
};

type ResolveDashboardAuth =
  | { tag: "ok"; session: DashboardSession }
  | { tag: "user_no_org" }
  | { tag: "no_session" };

function createLocalPreviewUser(profile: {
  id: string;
  name: string | null;
  role: string | null;
}): User {
  const now = new Date().toISOString();
  return {
    id: profile.id,
    app_metadata: {},
    user_metadata: {
      name: profile.name ?? "Local dashboard preview",
      needs_password: false,
    },
    aud: "authenticated",
    created_at: now,
    email: "local-dashboard-preview@cliste.test",
    role: "authenticated",
  };
}

type PreviewProfileRow = {
  id: string;
  account_id: string;
  organization_id: string | null;
  active_organization_id: string | null;
  name: string | null;
  role: string | null;
  avatar_url?: string | null;
};

const PROFILE_FIELDS_BASE =
  "id, account_id, organization_id, active_organization_id, name, role";
const PROFILE_FIELDS_WITH_AVATAR = `${PROFILE_FIELDS_BASE}, avatar_url`;
const SESSION_PROFILE_FIELDS_BASE =
  "account_id, organization_id, active_organization_id, name, role";
const SESSION_PROFILE_FIELDS_WITH_AVATAR = `${SESSION_PROFILE_FIELDS_BASE}, avatar_url`;

function isMissingAvatarUrlColumn(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42703" &&
    (error.message?.includes("avatar_url") ?? false)
  );
}


async function selectPreviewProfileForOrg(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
) {
  const baseQuery = () =>
    admin
      .from("profiles")
      .select(PROFILE_FIELDS_BASE)
      .not("account_id", "is", null)
      .or(
        `organization_id.eq.${organizationId},active_organization_id.eq.${organizationId}`,
      )
      .order("created_at", { ascending: true })
      .limit(1);

  const withAvatarQuery = () =>
    admin
      .from("profiles")
      .select(PROFILE_FIELDS_WITH_AVATAR)
      .not("account_id", "is", null)
      .or(
        `organization_id.eq.${organizationId},active_organization_id.eq.${organizationId}`,
      )
      .order("created_at", { ascending: true })
      .limit(1);

  const withAvatar = await withAvatarQuery();
  if (!withAvatar.error) return withAvatar;

  if (!isMissingAvatarUrlColumn(withAvatar.error)) {
    return withAvatar;
  }

  const fallback = await baseQuery();
  if (fallback.error || !fallback.data?.[0]) return fallback;
  return {
    ...fallback,
    data: fallback.data.map((profile) => ({ ...profile, avatar_url: null })),
  };
}

async function selectPreviewProfileById(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
) {
  const withAvatar = await admin
    .from("profiles")
    .select(PROFILE_FIELDS_WITH_AVATAR)
    .eq("id", profileId)
    .not("account_id", "is", null)
    .maybeSingle();

  if (!withAvatar.error) return withAvatar;

  if (!isMissingAvatarUrlColumn(withAvatar.error)) {
    return withAvatar;
  }

  const fallback = await admin
    .from("profiles")
    .select(PROFILE_FIELDS_BASE)
    .eq("id", profileId)
    .not("account_id", "is", null)
    .maybeSingle();

  if (fallback.error || !fallback.data) return fallback;
  return {
    ...fallback,
    data: { ...fallback.data, avatar_url: null },
  };
}

type SessionProfileData = {
  account_id: string;
  organization_id: string | null;
  active_organization_id: string | null;
  name: string | null;
  role: string | null;
  avatar_url: string | null;
};

function normalizeSessionProfile(
  profile: {
    account_id: string;
    organization_id: string | null;
    active_organization_id: string | null;
    name: string | null;
    role: string | null;
    avatar_url?: string | null;
  },
): SessionProfileData {
  return {
    account_id: profile.account_id,
    organization_id: profile.organization_id,
    active_organization_id: profile.active_organization_id,
    name: profile.name,
    role: profile.role,
    avatar_url: profile.avatar_url ?? null,
  };
}

async function selectSessionProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ data: SessionProfileData | null; error: Error | null }> {
  const withAvatar = await supabase
    .from("profiles")
    .select(SESSION_PROFILE_FIELDS_WITH_AVATAR)
    .eq("id", userId)
    .maybeSingle();

  if (!withAvatar.error) {
    return {
      data: withAvatar.data ? normalizeSessionProfile(withAvatar.data) : null,
      error: null,
    };
  }

  if (!isMissingAvatarUrlColumn(withAvatar.error)) {
    return { data: null, error: withAvatar.error };
  }

  const fallback = await supabase
    .from("profiles")
    .select(SESSION_PROFILE_FIELDS_BASE)
    .eq("id", userId)
    .maybeSingle();

  if (fallback.error || !fallback.data) {
    return { data: null, error: fallback.error ?? withAvatar.error };
  }
  return {
    data: normalizeSessionProfile({ ...fallback.data, avatar_url: null }),
    error: null,
  };
}

function previewSessionFromProfile(
  admin: ReturnType<typeof createAdminClient>,
  profile: PreviewProfileRow,
): DashboardSession | null {
  const orgId = profile.active_organization_id ?? profile.organization_id;
  if (!orgId) return null;

  return {
    supabase: admin,
    user: createLocalPreviewUser({
      id: profile.id,
      name: profile.name ?? null,
      role: profile.role ?? null,
    }),
    accountId: profile.account_id,
    organizationId: orgId,
    profile: {
      name: profile.name ?? null,
      role: profile.role ?? null,
      avatarUrl: profile.avatar_url ?? null,
    },
    isLocalPreview: true,
  };
}

async function loadPreviewProfileForOrg(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
): Promise<DashboardSession | null> {
  const { data: profiles, error } = await selectPreviewProfileForOrg(
    admin,
    organizationId,
  );

  const profile = profiles?.[0];
  if (error || !profile?.account_id) return null;
  return previewSessionFromProfile(admin, profile);
}

function offlinePreviewSession(): DashboardSession {
  return {
    supabase: createOfflinePreviewSupabase(),
    user: createLocalPreviewUser({
      id: OFFLINE_PREVIEW_PROFILE_ID,
      name: "Local tester",
      role: "owner",
    }),
    accountId: OFFLINE_PREVIEW_ACCOUNT_ID,
    organizationId: OFFLINE_PREVIEW_ORG_ID,
    profile: {
      name: "Local tester",
      role: "owner",
      avatarUrl: null,
    },
    isLocalPreview: true,
  };
}

async function resolveLocalPreviewDashboardAuth(): Promise<DashboardSession | null> {
  if (!isLocalDashboardPreviewEnabled()) return null;
  if (!supabaseServiceRoleLooksConfigured()) return offlinePreviewSession();

  try {
    const admin = createAdminClient();
    const preferredOrgId = process.env.CLISTE_LOCAL_DASHBOARD_ORG_ID?.trim();
    const preferredProfileId = process.env.CLISTE_LOCAL_DASHBOARD_PROFILE_ID?.trim();

    if (preferredProfileId) {
      const { data: profile, error } = await selectPreviewProfileById(
        admin,
        preferredProfileId,
      );
      if (!error && profile?.account_id) {
        const session = previewSessionFromProfile(admin, profile);
        if (session) return session;
      }
    }

    if (preferredOrgId) {
      const session = await loadPreviewProfileForOrg(admin, preferredOrgId);
      if (session) return session;
    }

    const { data: activeOrgs } = await admin
      .from("organizations")
      .select("id")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(5);

    for (const org of activeOrgs ?? []) {
      const session = await loadPreviewProfileForOrg(admin, org.id);
      if (session) return session;
    }

    const { data: profiles, error } = await admin
      .from("profiles")
      .select(PROFILE_FIELDS_WITH_AVATAR)
      .not("account_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(1);

    let resolvedProfiles = profiles;
    let resolvedError = error;
    if (error && isMissingAvatarUrlColumn(error)) {
      const fallback = await admin
        .from("profiles")
        .select(PROFILE_FIELDS_BASE)
        .not("account_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(1);
      resolvedProfiles =
        fallback.data?.map((profile) => ({
          ...profile,
          avatar_url: null,
        })) ?? null;
      resolvedError = fallback.error;
    }

    const profile = resolvedProfiles?.[0];
    if (!resolvedError && profile?.account_id) {
      const session = previewSessionFromProfile(admin, profile);
      if (session) return session;
    }
  } catch (error) {
    console.warn("[dashboard] local preview session unavailable", error);
  }

  return offlinePreviewSession();
}

async function resolveDashboardAuth(): Promise<ResolveDashboardAuth> {
  const previewSession = await resolveLocalPreviewDashboardAuth();
  if (previewSession) return { tag: "ok", session: previewSession };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { tag: "no_session" };
  }
  redirectIfEmailUnconfirmed(user);

  const { data: profile, error: profileError } = await selectSessionProfile(
    supabase,
    user.id,
  );

  const organizationId =
    profile?.active_organization_id ?? profile?.organization_id ?? null;
  if (profileError || !profile?.account_id || !organizationId) {
    return { tag: "user_no_org" };
  }

  return {
    tag: "ok",
    session: {
      supabase,
      user,
      accountId: profile.account_id,
      organizationId,
      profile: {
        name: profile.name ?? null,
        role: profile.role ?? null,
        avatarUrl: profile.avatar_url,
      },
    },
  };
}

export const requireDashboardSession = cache(
  async (): Promise<DashboardSession> => {
    const r = await resolveDashboardAuth();
    if (r.tag === "ok") return r.session;
    if (r.tag === "user_no_org") {
      redirect("/authenticate?error=profile");
    }
    redirect("/authenticate");
  }
);
