import {
  departmentTicketHref,
  resolveTicketDepartmentSlug,
} from "@/app/(dashboard)/dashboard/departments/department-helpers";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import type { VerticalId } from "@/lib/verticals";

export function dashboardFollowUpHubHref(verticalId: VerticalId): string {
  return verticalId === "retail"
    ? DASHBOARD_ROUTES.departments
    : DASHBOARD_ROUTES.actionInbox;
}

export function dashboardFollowUpHubLabel(verticalId: VerticalId): string {
  return verticalId === "retail" ? "Open Departments" : "Open Action Inbox";
}

export function dashboardFollowUpTicketHref(input: {
  verticalId: VerticalId;
  ticketId: string;
  departmentSlug?: string | null;
  summary?: string | null;
}): string {
  if (input.verticalId === "retail") {
    const slug = resolveTicketDepartmentSlug({
      department_slug: input.departmentSlug ?? null,
      summary: input.summary ?? "",
    });
    return departmentTicketHref(input.ticketId, slug);
  }

  return `${DASHBOARD_ROUTES.actionInbox}?ticket=${encodeURIComponent(input.ticketId)}`;
}
