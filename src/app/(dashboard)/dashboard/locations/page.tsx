import { cookies } from "next/headers";

import { canAddLocation, locationLabelForVertical } from "@/lib/account-locations";
import { loadAccountBilling, loadAccountLocations } from "@/lib/account-session";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import { verticalPackForNiche } from "@/lib/verticals";

import { LocationsView } from "./locations-view";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const session = await requireDashboardSession();
  const [locations, billing] = await Promise.all([
    loadAccountLocations(session.accountId),
    loadAccountBilling(session.accountId),
  ]);

  const { data: activeOrg } = await session.supabase
    .from("organizations")
    .select("niche")
    .eq("id", session.organizationId)
    .maybeSingle();

  const vertical = verticalPackForNiche(activeOrg?.niche);
  const locationLabel = locationLabelForVertical(vertical.id);
  const accountName =
    resolveOrganizationDisplayName(billing?.name, null) || "Your business";
  const planTier = billing?.planTier ?? "pro";
  const canAdd = canAddLocation(planTier, locations.length);
  const upgradeMessage = canAdd
    ? null
    : "Starter and Professional include one location. Upgrade to Business to add more sites.";

  void cookies;

  return (
    <LocationsView
      locations={locations}
      accountName={accountName}
      locationLabel={locationLabel}
      canAddLocation={canAdd}
      upgradeMessage={upgradeMessage}
      activeOrganizationId={session.organizationId}
    />
  );
}
