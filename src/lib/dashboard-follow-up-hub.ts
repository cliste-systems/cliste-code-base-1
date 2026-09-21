import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import type { VerticalId } from "@/lib/verticals";

export function dashboardFollowUpHubHref(_verticalId: VerticalId): string {
  return DASHBOARD_ROUTES.calls;
}

export function dashboardFollowUpHubLabel(_verticalId: VerticalId): string {
  return "Open Calls";
}

export function dashboardFollowUpTicketHref(_input: {
  verticalId: VerticalId;
  ticketId: string;
  departmentSlug?: string | null;
  summary?: string | null;
}): string {
  return DASHBOARD_ROUTES.calls;
}
