import { canManageDashboardConfig } from "@/lib/team-roles";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { createAdminClient } from "@/utils/supabase/admin";

import { TeamView } from "./team-view";

export default async function TeamPage() {
  const session = await requireDashboardSession();
  const admin = createAdminClient();

  const { data: profiles } = await session.supabase
    .from("profiles")
    .select("id, name, role")
    .eq("account_id", session.accountId)
    .order("created_at", { ascending: true });

  const members = await Promise.all(
    (profiles ?? []).map(async (profile) => {
      const { data: userData } = await admin.auth.admin.getUserById(profile.id);
      return {
        id: profile.id,
        name: profile.name,
        role: profile.role,
        email: userData.user?.email ?? null,
      };
    }),
  );

  return (
    <TeamView
      members={members}
      currentUserId={session.user.id}
      canManage={canManageDashboardConfig(session.profile.role)}
    />
  );
}
