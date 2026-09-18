import { redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export default function CaraKnowledgeHistoryRedirect() {
  redirect(DASHBOARD_ROUTES.caraKnowledgeHistory);
}
