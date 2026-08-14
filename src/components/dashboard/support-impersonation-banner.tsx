import { cookies } from "next/headers";

import {
  isValidSupportDashboardCookie,
  SUPPORT_DASHBOARD_COOKIE,
} from "@/lib/support-dashboard-cookie";

export async function SupportImpersonationBanner() {
  const jar = await cookies();
  const valid = await isValidSupportDashboardCookie(
    jar.get(SUPPORT_DASHBOARD_COOKIE)?.value,
  );
  if (!valid) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      You are viewing this account as Cliste support. Actions are audited.
    </div>
  );
}
