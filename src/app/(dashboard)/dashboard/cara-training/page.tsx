import { canManageDashboardConfig } from "@/lib/team-roles";
import { requireDashboardSession } from "@/lib/dashboard-session";

import { CaraTrainingView } from "./cara-training-view";
import { rowToTrainingItem } from "./cara-training-helpers";

type CaraTrainingPageProps = {
  searchParams?: Promise<{ item?: string }>;
};

export default async function CaraTrainingPage({
  searchParams,
}: CaraTrainingPageProps) {
  const session = await requireDashboardSession();
  const { supabase, organizationId, profile } = session;
  const sp = searchParams ? await searchParams : {};
  const initialItemId = sp.item?.trim() || null;

  const { data: rows, error } = await supabase
    .from("cara_training_items")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[cara-training] load", error.message);
  }

  const items = (rows ?? []).map((row) =>
    rowToTrainingItem(row as Record<string, unknown>),
  );

  const canManage = canManageDashboardConfig(profile?.role);

  return (
    <CaraTrainingView
      items={items}
      canManage={canManage}
      initialSelectedItemId={initialItemId}
    />
  );
}
