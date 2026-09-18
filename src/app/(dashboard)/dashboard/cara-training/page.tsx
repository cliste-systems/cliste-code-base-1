import { redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

type CaraTrainingRedirectProps = {
  searchParams?: Promise<{ item?: string }>;
};

export default async function CaraTrainingPage({
  searchParams,
}: CaraTrainingRedirectProps) {
  const sp = searchParams ? await searchParams : {};
  const item = sp.item?.trim();
  const target = item
    ? DASHBOARD_ROUTES.caraKnowledgeNeedsInputItem(item)
    : DASHBOARD_ROUTES.caraKnowledgeNeedsInput;
  redirect(target);
}

