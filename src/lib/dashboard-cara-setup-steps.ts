import type { CaraStatusSnapshot } from "@/lib/cara-status";
import { routesFromStoredLinks, isCustomRoute } from "@/app/(dashboard)/dashboard/routing/route-models";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export type CaraSetupStep = {
  id: string;
  label: string;
  complete: boolean;
  href: string;
};

export type CaraSetupOrgSnapshot = {
  agentServicesDepartments?: string | null;
  routingLinks?: unknown;
};

function hasConfiguredServices(services: string | null | undefined): boolean {
  return String(services ?? "").trim().length > 0;
}

function hasActiveCustomRouteWithUrl(routingLinks: unknown): boolean {
  const routes = routesFromStoredLinks(parseRoutingLinks(routingLinks));
  return routes.some(
    (route) =>
      isCustomRoute(route) &&
      route.active &&
      route.url.trim().length > 0,
  );
}

/** Derives setup checklist from existing Cara status (no extra queries). */
export function buildCaraSetupSteps(
  caraStatus: CaraStatusSnapshot,
  org?: CaraSetupOrgSnapshot | null,
): CaraSetupStep[] {
  const phoneConnected = caraStatus.phoneLine.value === "Connected";
  const isLive = caraStatus.isOnline;
  const servicesComplete =
    hasConfiguredServices(org?.agentServicesDepartments) || isLive;
  const routingComplete =
    hasActiveCustomRouteWithUrl(org?.routingLinks) || isLive;

  return [
    {
      id: "connect-number",
      label: "Connect number",
      complete: phoneConnected || isLive,
      href: DASHBOARD_ROUTES.settings,
    },
    {
      id: "add-services",
      label: "Add services",
      complete: servicesComplete,
      href: DASHBOARD_ROUTES.businessServices,
    },
    {
      id: "configure-call-flow",
      label: "Configure call flow",
      complete: routingComplete,
      href: DASHBOARD_ROUTES.routing,
    },
    {
      id: "test-go-live",
      label: "Test and go live",
      complete: isLive,
      href: DASHBOARD_ROUTES.businessProfile,
    },
  ];
}

export function firstIncompleteSetupHref(steps: CaraSetupStep[]): string {
  return steps.find((step) => !step.complete)?.href ?? DASHBOARD_ROUTES.businessProfile;
}
