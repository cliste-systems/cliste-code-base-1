import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";

import { createRouteFromTemplate, type SavedRoute } from "./route-models";
import { ROUTE_TEMPLATE_BY_ID } from "./route-templates";

export type StarterRouteSuggestion = {
  id: string;
  label: string;
  description: string;
  route: SavedRoute;
};

function bookingRoute(): SavedRoute | null {
  const template = ROUTE_TEMPLATE_BY_ID.get("booking-inquiry");
  if (!template) return null;
  return {
    ...createRouteFromTemplate(template),
    name: "Booking link",
    keywords: "book an appointment, schedule a booking",
    description: "Text the booking link when they want to schedule.",
  };
}

function quoteRoute(): SavedRoute | null {
  const template = ROUTE_TEMPLATE_BY_ID.get("quote-callback");
  if (!template) return null;
  return {
    ...createRouteFromTemplate(template),
    name: "Quote requests",
    keywords: "get a quote, how much does it cost, price estimate",
    description: "Take a message for a quote when they ask about pricing.",
  };
}

function speakToSomeoneRoute(transferAllowed: boolean): SavedRoute | null {
  if (transferAllowed) {
    const template = ROUTE_TEMPLATE_BY_ID.get("transfer");
    if (!template) return null;
    return {
      ...createRouteFromTemplate(template),
      name: "Speak to someone",
      keywords: "speak to someone, talk to a person, put me through",
      templateId: "transfer",
      outcome: "transfer",
    };
  }
  const template = ROUTE_TEMPLATE_BY_ID.get("quote-callback");
  if (!template) return null;
  return {
    ...createRouteFromTemplate(template),
    name: "Speak to someone",
    keywords: "speak to someone, talk to a person",
    outcome: "action_inbox",
    note: "Capture their name, number, and that they want to speak to someone on the team.",
  };
}

/** Tap-to-accept starter routes when the flow has no custom actions yet. */
export function starterRouteSuggestions(
  niche: string,
  transferAllowed: boolean,
): StarterRouteSuggestion[] {
  const copy = dashboardVerticalCopy(niche);
  const suggestions: StarterRouteSuggestion[] = [];

  const book = bookingRoute();
  if (book) {
    suggestions.push({
      id: "starter-book",
      label: copy.routing.starterBookLabel,
      description: copy.routing.starterBookDescription,
      route: book,
    });
  }

  const quote = quoteRoute();
  if (quote) {
    const showQuote = [
      "trades",
      "home_services",
      "automotive",
      "professional_services",
      "events",
    ].includes(niche);
    if (showQuote || !niche || niche === "generic") {
      suggestions.push({
        id: "starter-quote",
        label: "Get a quote",
        description: "Log quote requests in your Action Inbox.",
        route: quote,
      });
    }
  }

  const speak = speakToSomeoneRoute(transferAllowed);
  if (speak) {
    suggestions.push({
      id: "starter-speak",
      label: "Speak to someone",
      description: transferAllowed
        ? "Transfer when configured — otherwise take a message."
        : "Take a message when callers want a person.",
      route: speak,
    });
  }

  return suggestions;
}
