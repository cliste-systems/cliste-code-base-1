import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export type DashboardSessionProfile = {
  name: string | null;
  role: string | null;
};

export type DashboardSession = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  organizationId: string;
  /**
   * The caller's row from `public.profiles`. Loaded as part of the same
   * round-trip as `organization_id` so callers (e.g. the dashboard layout)
   * don't have to issue a second query for the user's display name/role.
   */
  profile: DashboardSessionProfile;
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

async function resolveLocalPreviewDashboardAuth(): Promise<DashboardSession | null> {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.CLISTE_LOCAL_DASHBOARD_UNLOCK !== "1") return null;

  try {
    const admin = createAdminClient();
    const preferredOrgId = process.env.CLISTE_LOCAL_DASHBOARD_ORG_ID?.trim();
    const preferredProfileId = process.env.CLISTE_LOCAL_DASHBOARD_PROFILE_ID?.trim();

    let profileQuery = admin
      .from("profiles")
      .select("id, organization_id, name, role")
      .not("organization_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(1);

    if (preferredProfileId) {
      profileQuery = profileQuery.eq("id", preferredProfileId);
    } else if (preferredOrgId) {
      profileQuery = profileQuery.eq("organization_id", preferredOrgId);
    }

    const { data: profiles, error } = await profileQuery;
    const profile = profiles?.[0];
    if (error || !profile?.organization_id) return null;

    return {
      supabase: admin,
      user: createLocalPreviewUser({
        id: profile.id,
        name: profile.name ?? null,
        role: profile.role ?? null,
      }),
      organizationId: profile.organization_id,
      profile: {
        name: profile.name ?? null,
        role: profile.role ?? null,
      },
    };
  } catch (error) {
    console.warn("[dashboard] local preview session unavailable", error);
    return null;
  }
}

async function resolveDashboardAuth(): Promise<ResolveDashboardAuth> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const previewSession = await resolveLocalPreviewDashboardAuth();
    if (previewSession) return { tag: "ok", session: previewSession };
    return { tag: "no_session" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.organization_id) {
    return { tag: "user_no_org" };
  }

  return {
    tag: "ok",
    session: {
      supabase,
      user,
      organizationId: profile.organization_id,
      profile: {
        name: profile.name ?? null,
        role: profile.role ?? null,
      },
    },
  };
}

export const getOptionalDashboardSession = cache(
  async (): Promise<DashboardSession | null> => {
    const r = await resolveDashboardAuth();
    if (r.tag === "ok") return r.session;
    return null;
  }
);

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
