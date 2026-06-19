import { redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export default function CaraSetupGeneralRedirectPage() {
  redirect(DASHBOARD_ROUTES.businessProfile);
}
