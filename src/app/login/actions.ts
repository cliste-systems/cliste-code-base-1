"use server";

import { cookies } from "next/headers";

import { SUPPORT_DASHBOARD_COOKIE } from "@/lib/support-dashboard-cookie";

/** Normal password sign-in is the salon user, not platform support — drop the support label. */
export async function clearSupportDashboardCookie() {
  (await cookies()).delete(SUPPORT_DASHBOARD_COOKIE);
}
