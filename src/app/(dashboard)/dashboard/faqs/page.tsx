import { redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export default function FaqsPage() {
  redirect(DASHBOARD_ROUTES.caraKnowledge);
}
