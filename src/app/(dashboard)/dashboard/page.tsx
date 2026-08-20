import { DashboardHomeLive } from "@/components/dashboard/dashboard-home-live";
import {
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
  DASHBOARD_HOME_CONTENT_COLUMN,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { loadDashboardHomeSnapshot } from "@/lib/dashboard-home-snapshot";
import { ALL_LOCATIONS_VIEW_COOKIE } from "@/lib/account-locations";
import { parseDashboardMetricRange } from "@/lib/dashboard-metric-range";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type DashboardHomePageProps = {
  searchParams?: Promise<{ range?: string; welcome?: string }>;
};

export default async function DashboardHomePage({
  searchParams,
}: DashboardHomePageProps) {
  const session = await requireDashboardSession();
  const cookieStore = await cookies();
  const viewAllLocations =
    cookieStore.get(ALL_LOCATIONS_VIEW_COOKIE)?.value === "1";

  const sp = searchParams ? await searchParams : {};
  const metricRange = parseDashboardMetricRange(sp.range);
  const orgRow = await getCachedDashboardOrganizationRow();

  const snapshot = await loadDashboardHomeSnapshot({
    session,
    metricRange,
    viewAllLocations,
    niche: orgRow?.niche,
    agentBusinessType: orgRow?.agent_business_type,
  });

  return (
    <div
      className={cn(DASHBOARD_PAGE_SHELL_FILL_WHITE, "min-h-0")}
      data-dashboard-fill
      data-dashboard-home
    >
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <DashboardHomeLive
          organizationId={session.organizationId}
          metricRange={metricRange}
          initialSnapshot={snapshot}
          enterClassName="min-h-0 flex-1 lg:h-full"
          heroClassName="shrink-0 lg:h-[220px] lg:max-h-[220px] lg:min-h-[200px]"
          cardsClassName="min-h-0 flex-1"
        />
      </div>
    </div>
  );
}
