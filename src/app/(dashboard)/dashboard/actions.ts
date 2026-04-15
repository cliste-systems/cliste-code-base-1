"use server";

import { cookies } from "next/headers";

import { SUPPORT_DASHBOARD_COOKIE } from "@/lib/support-dashboard-cookie";

/** Same name as in `middleware.ts` (dashboard gate cookie). */
const DASHBOARD_GATE_COOKIE = "cliste_dashboard_gate";

/** Clears support-view flag and dashboard gate so the next visit is a clean sign-in. */
export async function clearDashboardSessionCookies() {
  const jar = await cookies();
  jar.delete(SUPPORT_DASHBOARD_COOKIE);
  jar.delete(DASHBOARD_GATE_COOKIE);
}
