import { createRouteFromTemplate, type SavedRoute } from "./route-models";
import {
  ROUTE_ACTION_TYPE_BY_ID,
  ROUTE_TEMPLATE_BY_ID,
  type RouteActionType,
} from "./route-templates";

/** Cara Setup + Settings fields used to prefill route editors. */
export type RoutingCaraContext = {
  locationAddress: string;
  locationEircode: string;
  notificationEmail: string;
  notificationPhone: string;
};

export const EMPTY_ROUTING_CARA_CONTEXT: RoutingCaraContext = {
  locationAddress: "",
  locationEircode: "",
  notificationEmail: "",
  notificationPhone: "",
};

type OrgLocationRow = {
  agent_location_address?: string | null;
  agent_location_eircode?: string | null;
  address?: string | null;
  storefront_eircode?: string | null;
  notification_email?: string | null;
  notification_phone?: string | null;
};

export function routingCaraContextFromOrg(
  org: OrgLocationRow | null | undefined,
): RoutingCaraContext {
  if (!org) return EMPTY_ROUTING_CARA_CONTEXT;
  return {
    locationAddress:
      (org.agent_location_address as string | null)?.trim() ||
      (org.address as string | null)?.trim() ||
      "",
    locationEircode:
      (org.agent_location_eircode as string | null)?.trim() ||
      (org.storefront_eircode as string | null)?.trim() ||
      "",
    notificationEmail: (org.notification_email as string | null)?.trim() || "",
    notificationPhone: (org.notification_phone as string | null)?.trim() || "",
  };
}

export function hasCaraLocation(ctx: RoutingCaraContext): boolean {
  return Boolean(ctx.locationAddress.trim() || ctx.locationEircode.trim());
}

export function caraLocationDisplay(ctx: RoutingCaraContext): string {
  const parts = [ctx.locationAddress.trim(), ctx.locationEircode.trim()].filter(
    Boolean,
  );
  return parts.join(", ");
}

export function buildGoogleMapsUrl(ctx: RoutingCaraContext): string | null {
  const query = caraLocationDisplay(ctx);
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function defaultLocationUrl(ctx: RoutingCaraContext): string {
  return buildGoogleMapsUrl(ctx) ?? "";
}

export function whatsAppLinkFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}`;
}

export function locationLinksNeedFill(route: SavedRoute): boolean {
  return !route.url.trim();
}

/** Apply Cara Setup / Settings defaults when creating a new route. */
export function applyCaraDefaultsToNewRoute(
  route: SavedRoute,
  context: RoutingCaraContext,
): SavedRoute {
  switch (route.templateId) {
    case "location": {
      const url = defaultLocationUrl(context);
      return url ? { ...route, url } : route;
    }
    case "email": {
      const email = context.notificationEmail.trim();
      return email ? { ...route, email } : route;
    }
    case "whatsapp": {
      const wa = whatsAppLinkFromPhone(context.notificationPhone);
      return wa ? { ...route, whatsapp: wa } : route;
    }
    default:
      return route;
  }
}

export function fillLocationLinksFromCara(
  route: SavedRoute,
  context: RoutingCaraContext,
): SavedRoute {
  if (route.templateId !== "location" || !hasCaraLocation(context)) return route;
  return { ...route, url: defaultLocationUrl(context) };
}

const DEFAULT_ACTION_TYPE: RouteActionType = "send_link";

/** Create a fresh route for an action type (used by "Add action"). */
export function buildRouteForActionType(
  actionType: RouteActionType,
  context: RoutingCaraContext,
  opts?: { name?: string },
): SavedRoute {
  const meta =
    ROUTE_ACTION_TYPE_BY_ID.get(actionType) ??
    ROUTE_ACTION_TYPE_BY_ID.get(DEFAULT_ACTION_TYPE)!;
  const template = ROUTE_TEMPLATE_BY_ID.get(meta.templateId)!;
  const base = createRouteFromTemplate(template);
  return applyCaraDefaultsToNewRoute(
    { ...base, name: opts?.name ?? "" },
    context,
  );
}

/**
 * Convert an existing route to a different action type, keeping its id, name,
 * and active flag while resetting fields that no longer apply.
 */
export function switchRouteActionType(
  route: SavedRoute,
  actionType: RouteActionType,
  context: RoutingCaraContext,
): SavedRoute {
  const meta = ROUTE_ACTION_TYPE_BY_ID.get(actionType);
  if (!meta) return route;
  const next: SavedRoute = {
    ...route,
    templateId: meta.templateId,
    outcome: meta.outcome,
    url: meta.outcome === "send_link" ? route.url : "",
    businessFileId: meta.outcome === "send_file" ? route.businessFileId : null,
    email: meta.outcome === "email" ? route.email : "",
    whatsapp: meta.outcome === "whatsapp" ? route.whatsapp : "",
    note: route.note,
    transferDuringHoursOnly:
      meta.outcome === "transfer" ? route.transferDuringHoursOnly : undefined,
  };

  return applyCaraDefaultsToNewRoute(next, context);
}
