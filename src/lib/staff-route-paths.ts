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

/** Paths on `book.*` that should be redirected to `app.*`. */
export function pathIsStaffRouteRedirectingBookToApp(path: string): boolean {
  if (path === "/login" || path.startsWith("/login/")) return true;
  if (pathIsTenantDashboardSection(path)) return true;
  if (pathIsAgencyAdminSection(path)) return true;
  if (path === "/dashboard-unlock" || path.startsWith("/dashboard-unlock/"))
    return true;
  if (path === "/admin-unlock" || path.startsWith("/admin-unlock/"))
    return true;
  return false;
}
