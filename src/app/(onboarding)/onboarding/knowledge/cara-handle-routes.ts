import {
  createRouteFromTemplate,
  ensureFallbackRoute,
  isFallbackRoute,
  type SavedRoute,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { ROUTE_TEMPLATE_BY_ID } from "@/app/(dashboard)/dashboard/routing/route-templates";

import {
  CARA_HANDLE_OPTIONS,
  ensureRequiredHandleOptions,
  type CaraHandleOptionId,
} from "./train-cara-constants";

const QUOTE_NOTE =
  "Capture what they need, their location, urgency, and contact details.";

function routeForHandleOption(id: CaraHandleOptionId): SavedRoute | null {
  switch (id) {
    case "answer_common_questions":
      return null;
    case "send_link": {
      const template = ROUTE_TEMPLATE_BY_ID.get("form-application");
      return template ? createRouteFromTemplate(template) : null;
    }
    case "send_file": {
      const template = ROUTE_TEMPLATE_BY_ID.get("brochure");
      return template ? createRouteFromTemplate(template) : null;
    }
    case "take_message":
      // Covered by the fallback Action Inbox route — no separate trigger needed.
      return null;
    case "email_request": {
      const template = ROUTE_TEMPLATE_BY_ID.get("email");
      return template ? createRouteFromTemplate(template) : null;
    }
    case "send_whatsapp": {
      const template = ROUTE_TEMPLATE_BY_ID.get("whatsapp");
      return template ? createRouteFromTemplate(template) : null;
    }
    case "capture_quote_requests": {
      const template = ROUTE_TEMPLATE_BY_ID.get("quote-callback");
      if (!template) return null;
      return {
        ...createRouteFromTemplate(template),
        name: "Quote requests",
        note: QUOTE_NOTE,
      };
    }
    case "book_meeting": {
      const template = ROUTE_TEMPLATE_BY_ID.get("booking-inquiry");
      if (!template) return null;
      return {
        ...createRouteFromTemplate(template),
        name: "Book a meeting",
      };
    }
    default:
      return null;
  }
}

export function buildRoutesFromHandleOptions(
  selected: CaraHandleOptionId[],
): SavedRoute[] {
  const routes: SavedRoute[] = [];

  for (const id of selected) {
    const route = routeForHandleOption(id);
    if (route) routes.push(route);
  }

  return ensureFallbackRoute(routes);
}

export function caraActionLabel(route: SavedRoute): string {
  switch (route.outcome) {
    case "send_link":
      return "send a link";
    case "send_file":
      return "send a file";
    case "email":
      return "email the request";
    case "whatsapp":
      return "follow up on WhatsApp";
    case "action_inbox":
      if (isFallbackRoute(route)) return "take a message";
      return "take a message";
    default:
      return "help the caller";
  }
}

export function caraTriggerLabel(route: SavedRoute): string {
  if (isFallbackRoute(route)) return "anything else";
  return route.name.trim().toLowerCase() || "this";
}

/**
 * Per-vertical suggested handle options (industry template), drawn only from
 * the onboarding picker subset. Used to pre-select sensible defaults.
 */
export function suggestedHandleOptionsForBusiness(
  niche: string,
): CaraHandleOptionId[] {
  switch (niche) {
    case "trades":
    case "home_services":
    case "automotive":
      return ["capture_quote_requests", "send_link"];
    case "hair_salon":
    case "barber":
    case "beauty":
    case "fitness":
    case "hospitality":
      return ["send_link"];
    case "retail":
    case "ecommerce":
    case "education":
      return ["send_link", "email_request"];
    case "events":
      return ["capture_quote_requests", "email_request"];
    case "professional_services":
      return ["send_link", "email_request"];
    default:
      return ["send_link"];
  }
}

export function parseHandleOptions(raw: unknown): CaraHandleOptionId[] {
  if (!Array.isArray(raw)) return ensureRequiredHandleOptions([]);
  const valid = new Set(CARA_HANDLE_OPTIONS.map((o) => o.id));
  const parsed = raw.filter(
    (id): id is CaraHandleOptionId => typeof id === "string" && valid.has(id as CaraHandleOptionId),
  );
  return ensureRequiredHandleOptions(parsed);
}
