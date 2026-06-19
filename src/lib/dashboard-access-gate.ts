import {
  DASHBOARD_LEGAL_ACCEPT_PATH,
  isLegalAcceptanceBypassPath,
} from "@/lib/legal-documents";

export const DASHBOARD_SET_PASSWORD_PATH = "/dashboard/set-password";

/** Routes reachable before contractual acceptances are recorded. */
export function isDashboardAccessGatePath(pathname: string): boolean {
  return (
    pathname === DASHBOARD_LEGAL_ACCEPT_PATH ||
    pathname === DASHBOARD_SET_PASSWORD_PATH ||
    isLegalAcceptanceBypassPath(pathname)
  );
}
