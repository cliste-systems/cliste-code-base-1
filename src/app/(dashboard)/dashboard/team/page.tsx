import { TeamView } from "./team-view";
import { canManageDashboardConfig } from "@/lib/team-roles";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { createAdminClient } from "@/utils/supabase/admin";

export default async function TeamPage() {
  const session = await requireDashboardSession();
  const admin = createAdminClient();

  const { data: profiles } = await session.supabase
    .from("profiles")
    .select("id, name, role")
    .eq("account_id", session.accountId)
    .order("created_at", { ascending: true });

  const memberIds = new Set((profiles ?? []).map((profile) => profile.id));
  const { data: authList } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailById = new Map(
    (authList?.users ?? [])
      .filter((user) => memberIds.has(user.id))
      .map((user) => [user.id, user.email ?? null] as const),
  );

  const members = (profiles ?? []).map((profile) => ({
    id: profile.id,
    name: profile.name,
    role: profile.role,
    email: emailById.get(profile.id) ?? null,
  }));

  return (
    <TeamView
      members={members}
      currentUserId={session.user.id}
      canManage={canManageDashboardConfig(session.profile.role)}
    />
  );
}
