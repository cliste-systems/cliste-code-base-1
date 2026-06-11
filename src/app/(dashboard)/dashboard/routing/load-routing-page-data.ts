import { requireDashboardSession } from "@/lib/dashboard-session";

import { listSendableBusinessFiles } from "../agent-setup/business-files-actions";
import {
  ensureAccountRoutes,
  customRoutes,
  routesFromStoredLinks,
} from "./route-models";
import { routingCaraContextFromOrg } from "./routing-cara-context";
import { parseRoutingLinks } from "./routing-links";
import { routingSetupContextFromOrg } from "./routing-setup-context";
import type { RoutingCaraContext } from "./routing-cara-context";
import type { RoutingSetupContext } from "./routing-setup-context";
import type { SavedRoute } from "./route-models";
import type { BusinessFileListItem } from "@/lib/business-files";

export type RoutingPageData = {
  initialRoutes: SavedRoute[];
  sendableFiles: BusinessFileListItem[];
  caraContext: RoutingCaraContext;
  setupContext: RoutingSetupContext;
};

export async function loadRoutingPageData(): Promise<RoutingPageData> {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "routing_links, agent_location_address, agent_location_eircode, address, storefront_eircode, notification_email, notification_phone, greeting, agent_details_to_collect, agent_services_not_offered, agent_services_departments, fallback_number, call_routing_mode, niche, name",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const links = parseRoutingLinks(
    (org as { routing_links?: unknown } | null)?.routing_links,
  );
  const initialRoutes = ensureAccountRoutes(routesFromStoredLinks(links));
  const sendableFiles = await listSendableBusinessFiles();

  return {
    initialRoutes,
    sendableFiles,
    caraContext: routingCaraContextFromOrg(org),
    setupContext: routingSetupContextFromOrg(org),
  };
}

export function routingHeaderCounts(routes: SavedRoute[]): {
  routeCount: number;
  builtinOn: boolean;
} {
  return {
    routeCount: customRoutes(routes).length,
    builtinOn: true,
  };
}
