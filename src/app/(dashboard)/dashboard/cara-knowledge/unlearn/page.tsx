import { redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export default function CaraKnowledgeUnlearnRedirect() {
  redirect(DASHBOARD_ROUTES.caraKnowledge);
}
