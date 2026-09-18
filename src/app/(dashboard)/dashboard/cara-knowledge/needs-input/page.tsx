import { redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

type RedirectPageProps = {
  searchParams?: Promise<{ item?: string }>;
};

export default async function CaraKnowledgeNeedsInputRedirect({
  searchParams,
}: RedirectPageProps) {
  const sp = searchParams ? await searchParams : {};
  const item = sp.item?.trim();
  redirect(
    item
      ? DASHBOARD_ROUTES.caraKnowledgeNeedsInputItem(item)
      : DASHBOARD_ROUTES.caraKnowledgeNeedsInput,
  );
}
