import { redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export default function LegacyPrivacyRedirect() {
  redirect(DASHBOARD_ROUTES.legalDataRequests);
}
