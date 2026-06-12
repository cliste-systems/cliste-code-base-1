import { redirect } from "next/navigation";

import {
  canManageDashboardConfig,
  dashboardRoleLabel,
} from "@/lib/team-roles";

import {
  requireDashboardSession,
  type DashboardSession,
} from "./dashboard-session";

export async function requireDashboardAdmin(): Promise<DashboardSession> {
  const session = await requireDashboardSession();
  if (!canManageDashboardConfig(session.profile.role)) {
    redirect("/dashboard");
  }
  return session;
}

export { dashboardRoleLabel };
