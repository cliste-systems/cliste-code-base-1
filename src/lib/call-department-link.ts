import { classifyActionDepartment } from "@/lib/classify-action-department";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  departmentWorkspaceSlug,
  retailDepartmentBySlug,
  type RetailDepartmentSlug,
} from "@/lib/retail-department-pack";

export type CallDepartmentLink = {
  slug: RetailDepartmentSlug;
  href: string;
  buttonLabel: string;
};

export function callDepartmentButtonLabel(slug: RetailDepartmentSlug): string {
  const workspace = departmentWorkspaceSlug(slug);
  return `Open in ${retailDepartmentBySlug(workspace).shortLabel}`;
}

export function resolveCallDepartmentLink(input: {
  aiSummary?: string | null;
  followUpSummary?: string | null;
  followUpTicketId?: string | null;
  departmentSlug?: string | null;
}): CallDepartmentLink | null {
  const summary =
    input.followUpSummary?.trim() ||
    input.aiSummary?.trim() ||
    "";
  if (!summary) return null;

  const slug = classifyActionDepartment({
    summary,
    departmentSlug: input.departmentSlug,
  });

  const workspace = departmentWorkspaceSlug(slug);
  const ticketId = input.followUpTicketId?.trim();
  const href = ticketId
    ? `${DASHBOARD_ROUTES.department(workspace)}?ticket=${encodeURIComponent(ticketId)}`
    : DASHBOARD_ROUTES.department(workspace);

  return {
    slug,
    href,
    buttonLabel: callDepartmentButtonLabel(slug),
  };
}
