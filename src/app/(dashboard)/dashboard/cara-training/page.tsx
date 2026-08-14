import { GraduationCap } from "lucide-react";

import { canManageDashboardConfig } from "@/lib/team-roles";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";

import { CaraTrainingView } from "./cara-training-view";
import {
  isOpenTrainingStatus,
  rowToTrainingItem,
} from "./cara-training-helpers";

type CaraTrainingPageProps = {
  searchParams?: Promise<{ item?: string }>;
};

export default async function CaraTrainingPage({
  searchParams,
}: CaraTrainingPageProps) {
  const session = await requireDashboardSession();
  const { supabase, organizationId, profile } = session;
  const sp = searchParams ? await searchParams : {};
  const initialItemId = sp.item?.trim() || null;

  const [orgRow, { data: rows, error }] = await Promise.all([
    getCachedDashboardOrganizationRow(),
    supabase
      .from("cara_training_items")
      .select("*")
      .eq("organization_id", organizationId)
      .neq("status", "dismissed")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (error) {
    console.error("[cara-training] load", error.message);
  }

  const items = (rows ?? []).map((row) =>
    rowToTrainingItem(row as Record<string, unknown>),
  );
  const openCount = items.filter((item) => isOpenTrainingStatus(item.status)).length;
  const learnedCount = items.filter((item) => item.status === "applied").length;
  const canManage = canManageDashboardConfig(profile?.role);
  const description = dashboardVerticalCopy(
    orgRow?.niche,
    orgRow?.agent_business_type,
  ).training.description;

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <DashboardAnimatedPageSections className="min-h-0 flex-1 gap-3 overflow-hidden">
          <ClistePageHeader
            tone="training"
            icon={GraduationCap}
            title="Knowledge Gaps"
            description={description}
            summary={[
              { value: String(openCount), label: "needs input" },
              { value: String(learnedCount), label: "learned" },
            ]}
          />

          {error ? (
            <p className="shrink-0 text-[13px] text-red-700">
              Could not load training: {error.message}
            </p>
          ) : (
            <CaraTrainingView
              className="min-h-0 flex-1"
              items={items}
              canManage={canManage}
              initialSelectedItemId={initialItemId}
            />
          )}
        </DashboardAnimatedPageSections>
      </div>
    </div>
  );
}
