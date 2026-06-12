import "server-only";

import { loadAccountLocations } from "@/lib/account-session";
import type { DashboardSession } from "@/lib/dashboard-session";

export type DashboardOrganizationScope = {
  organizationIds: string[];
  viewAllLocations: boolean;
};

export async function resolveDashboardOrganizationScope(
  session: DashboardSession,
  viewAllLocations: boolean,
): Promise<DashboardOrganizationScope> {
  if (!viewAllLocations) {
    return {
      organizationIds: [session.organizationId],
      viewAllLocations: false,
    };
  }

  const locations = await loadAccountLocations(session.accountId);
  return {
    organizationIds: locations.map((location) => location.id),
    viewAllLocations: true,
  };
}
