import { redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

type TeachRedirectProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function CaraKnowledgeTeachRedirect({
  searchParams,
}: TeachRedirectProps) {
  const sp = searchParams ? await searchParams : {};
  const q = sp.q?.trim();
  redirect(q ? `${DASHBOARD_ROUTES.caraKnowledgeTeach}&q=${encodeURIComponent(q)}` : DASHBOARD_ROUTES.caraKnowledgeTeach);
}
