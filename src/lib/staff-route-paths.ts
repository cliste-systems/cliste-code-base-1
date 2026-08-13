/**
 * Path boundaries for staff-only areas (agency `/admin` vs tenant `/dashboard`).
 */

/** Password gate for the internal admin console (separate from tenant sign-in). */
export const ADMIN_LOGIN_PATH = "/admin/login";

export function pathIsAdminLogin(path: string): boolean {
  return path === ADMIN_LOGIN_PATH;
}

export function pathIsAgencyAdminSection(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

export function pathIsTenantDashboardSection(path: string): boolean {
  return path === "/dashboard" || path.startsWith("/dashboard/");
}
