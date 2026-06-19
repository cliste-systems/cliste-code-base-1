import { redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export default function CaraSetupServicesRedirectPage() {
  redirect(DASHBOARD_ROUTES.businessServices);
}
