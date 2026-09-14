import type { SupabaseClient } from "@supabase/supabase-js";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { getDashboardMetricRangeLowerBoundIso } from "@/lib/dashboard-metric-range";
import { classifyActionDepartment } from "@/lib/classify-action-department";
import {
  isRetailDepartmentSlug,
  retailDepartmentNavItems,
  departmentWorkspaceSlug,
  type RetailDepartmentSlug,
} from "@/lib/retail-department-pack";

export {
  DASHBOARD_ACTION_INBOX_SEEN_COOKIE,
  DASHBOARD_CALL_HISTORY_SEEN_COOKIE,
  DASHBOARD_CARA_TRAINING_SEEN_COOKIE,
} from "./dashboard-nav-seen-cookies";

export type DashboardNavBadgeMap = Partial<Record<string, number>>;

export type DashboardNavSeenAt = {
  callHistory: Date | null;
  actionInbox: Date | null;
  caraTraining: Date | null;
};

function countHead(
  res: { count: number | null; error: { message: string } | null },
): number {
  if (res.error) return 0;
  return res.count ?? 0;
}

/**
 * Sidebar badges show live totals (open inbox, training gaps, calls today).
 * Visiting a page does not clear the count.
 */
export async function fetchDashboardNavBadges(
  supabase: SupabaseClient,
  organizationId: string,
  _seen: DashboardNavSeenAt | null | undefined,
): Promise<DashboardNavBadgeMap> {
  const callsTodaySince = getDashboardMetricRangeLowerBoundIso("today");

  const [openRes, callHistoryRes, trainingRes, openByDeptRes] = await Promise.all([
    supabase
      .from("action_tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "open"),
    supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", callsTodaySince),
    supabase
      .from("cara_training_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["awaiting_answer", "draft_ready"]),
    supabase
      .from("action_tickets")
      .select("department_slug, summary")
      .eq("organization_id", organizationId)
      .eq("status", "open"),
  ]);

  const callBadge = countHead(callHistoryRes);
  const inboxBadge = countHead(openRes);
  const trainingBadge = countHead(trainingRes);

  const badges: DashboardNavBadgeMap = {
    "/dashboard/action-inbox": inboxBadge,
    "/dashboard/calls": callBadge,
    "/dashboard/call-history": callBadge,
    [DASHBOARD_ROUTES.caraTraining]: trainingBadge,
    [DASHBOARD_ROUTES.departments]: inboxBadge,
  };

  if (!openByDeptRes.error) {
    const counts = new Map<RetailDepartmentSlug, number>();
    for (const row of openByDeptRes.data ?? []) {
      const stored = String(
        (row as { department_slug?: string | null }).department_slug ?? "",
      ).trim();
      const summary = String(
        (row as { summary?: string | null }).summary ?? "",
      );
      const resolved =
        stored && isRetailDepartmentSlug(stored) && stored !== "general"
          ? stored
          : classifyActionDepartment({ summary, departmentSlug: stored || null });
      const workspace = departmentWorkspaceSlug(resolved);
      counts.set(workspace, (counts.get(workspace) ?? 0) + 1);
    }
    for (const dept of retailDepartmentNavItems()) {
      const count = counts.get(dept.slug) ?? 0;
      if (count > 0) {
        badges[DASHBOARD_ROUTES.department(dept.slug)] = count;
      }
    }
  }

  return badges;
}

export function formatNavBadgeCount(n: number): string {
  if (n > 99) return "99+";
  return String(n);
}

export function buildRetailDepartmentsSidebarNav(
  badges: DashboardNavBadgeMap,
): { href: string; label: string; badge?: number }[] {
  const overviewBadge = badges[DASHBOARD_ROUTES.departments];
  return [
    {
      href: DASHBOARD_ROUTES.departments,
      label: "All departments",
      ...(typeof overviewBadge === "number" && overviewBadge > 0
        ? { badge: overviewBadge }
        : {}),
    },
    ...retailDepartmentNavItems().map((dept) => {
      const href = DASHBOARD_ROUTES.department(dept.slug);
      const badge = badges[href];
      return {
        href,
        label: dept.shortLabel,
        ...(typeof badge === "number" && badge > 0 ? { badge } : {}),
      };
    }),
  ];
}
