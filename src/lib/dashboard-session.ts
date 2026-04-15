import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/server";

export type DashboardSession = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  organizationId: string;
};

type ResolveDashboardAuth =
  | { tag: "ok"; session: DashboardSession }
  | { tag: "user_no_org" }
  | { tag: "no_session" };

async function resolveDashboardAuth(): Promise<ResolveDashboardAuth> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { tag: "no_session" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
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
