/**
 * Path boundaries for staff-only areas vs public `/[salonSlug]` routes.
 * Slugs like `admin-salon` must not match agency `/admin`.
 */

export function pathIsAgencyAdminSection(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

export function pathIsTenantDashboardSection(path: string): boolean {
  return path === "/dashboard" || path.startsWith("/dashboard/");
}
