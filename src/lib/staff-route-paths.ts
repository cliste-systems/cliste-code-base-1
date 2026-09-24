/**
 * Path boundaries for staff-only areas (agency `/admin` vs tenant `/dashboard`).
 */

export function pathIsAgencyAdminSection(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

export function pathIsTenantDashboardSection(path: string): boolean {
  return path === "/dashboard" || path.startsWith("/dashboard/");
}
