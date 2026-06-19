import { redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export const dynamic = "force-dynamic";

/** Legacy path — canonical business profile lives under /dashboard/business/profile. */
export default function AgentSetupPage() {
  redirect(DASHBOARD_ROUTES.businessProfile);
}
