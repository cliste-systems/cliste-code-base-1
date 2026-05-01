import { cache } from "react";

import { requireDashboardSession } from "@/lib/dashboard-session";

export type DashboardOrganizationRow = {
  tier: string | null;
  status: string | null;
};

/**
 * One organizations row fetch per request (layout + pages share via React cache).
 */
export const getCachedDashboardOrganizationRow = cache(
  async (): Promise<DashboardOrganizationRow | null> => {
    const { supabase, organizationId } = await requireDashboardSession();
    const { data, error } = await supabase
      .from("organizations")
      .select("tier, status")
      .eq("id", organizationId)
      .maybeSingle();
    if (error) return null;
    return (data as DashboardOrganizationRow) ?? null;
  },
);
