import { revalidatePath } from "next/cache";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  actionTicketBriefSummary,
  classifyActionDepartment,
} from "@/lib/classify-action-department";
import {
  departmentRequestTypeLabel,
  parseDepartmentRequestSummary,
} from "@/lib/department-request-summary";
import {
  isRetailDepartmentSlug,
  mapStoreDepartmentNameToSlug,
  type RetailDepartmentSlug,
} from "@/lib/retail-department-pack";
import { createAdminClient } from "@/utils/supabase/admin";

const DEPT_ROUTE_PREFIX = "dept-";

async function resolveStoreDepartmentName(
  routeId: string,
): Promise<string | null> {
  if (!routeId.startsWith(DEPT_ROUTE_PREFIX)) return null;
  const departmentId = routeId.slice(DEPT_ROUTE_PREFIX.length).trim();
  if (!departmentId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("store_departments")
    .select("name")
    .eq("id", departmentId)
    .maybeSingle();

  return data?.name?.trim() || null;
}

export async function resolveActionTicketDepartment(input: {
  summary: string;
  departmentSlug?: string | null;
  routeId?: string | null;
}): Promise<RetailDepartmentSlug> {
  const explicit = String(input.departmentSlug ?? "").trim();
  if (explicit && isRetailDepartmentSlug(explicit)) {
    return explicit;
  }

  const routeId = String(input.routeId ?? "").trim();
  const storeDepartmentName = routeId
    ? await resolveStoreDepartmentName(routeId)
    : null;
  const storeSlug = mapStoreDepartmentNameToSlug(storeDepartmentName);

  return classifyActionDepartment({
    summary: input.summary,
    departmentSlug: explicit || storeSlug,
    routeId,
    storeDepartmentName,
  });
}

export function buildActionTicketBriefSummary(summary: string): string {
  const parsed = parseDepartmentRequestSummary(summary);
  if (parsed) {
    return departmentRequestTypeLabel(parsed.header);
  }

  const firstLine = summary.split(/\n/)[0]?.trim() ?? "";
  if (firstLine) {
    return departmentRequestTypeLabel(firstLine);
  }

  return actionTicketBriefSummary(summary);
}

export function revalidateActionTicketSurfaces(departmentSlug?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath(DASHBOARD_ROUTES.actionInbox);
  revalidatePath(DASHBOARD_ROUTES.departments);
  const slug = String(departmentSlug ?? "").trim();
  if (slug && isRetailDepartmentSlug(slug)) {
    revalidatePath(DASHBOARD_ROUTES.department(slug));
  }
}
