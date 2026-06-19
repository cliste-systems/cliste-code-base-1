import { redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export default function CaraSetupAnswersRedirectPage() {
  redirect(DASHBOARD_ROUTES.businessFaqs);
}
