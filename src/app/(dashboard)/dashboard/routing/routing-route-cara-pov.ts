import type { BusinessFileListItem } from "@/lib/business-files";

import { inferBookingFulfilmentMethod } from "./booking-fulfilment";
import { describeRouteAction } from "./route-match";
import {
  routeActionType,
  routeDestinationLabel,
  routeKeywords,
  type SavedRoute,
} from "./route-models";

export type RouteCaraPov = {
  /** First-person lines — what Cara will do. */
  will: string[];
  /** First-person lines — what Cara will not do. */
  wont: string[];
};

export function buildRouteCaraPov(
  route: SavedRoute,
  sendableFiles: BusinessFileListItem[],
): RouteCaraPov {
  const keywords = routeKeywords(route);
  const keywordSamples = keywords
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  const desc = route.description?.trim();
  const rules = route.note.trim();
  const action = routeActionType(route);
  const destination = routeDestinationLabel(route);
  const actionDetail = describeRouteAction(route, sendableFiles);
  const bookingMethod =
    route.templateId === "booking-inquiry"
      ? inferBookingFulfilmentMethod(route)
      : null;

  const matchLine =
    desc && keywordSamples.length > 0
      ? `When they say things like “${keywordSamples.join('”, “')}” — ${desc}`
      : keywordSamples.length > 0
        ? `When they say things like “${keywordSamples.join('”, “')}”, I'll use this route.`
        : desc
          ? desc
          : `I'll use this route when it matches what they need.`;

  const will: string[] = [matchLine];

  if (bookingMethod === "callback") {
    will.push(
      `I'll capture their booking details for your team to call back — this is a request, not a confirmed appointment.`,
    );
  } else if (bookingMethod === "both") {
    const delivery = route.linkDelivery ?? "sms";
    const deliveryLine =
      delivery === "email"
        ? "I'll offer the booking link, then email it if they want it."
        : delivery === "both"
          ? "I'll offer the booking link, then ask if they want it by text or email."
          : "I'll offer the booking link, then text it if they want it.";
    will.push(deliveryLine);
    will.push(
      `I'll also log a backup booking request in your Action Inbox with the details I capture.`,
    );
  } else {
    switch (action) {
      case "directions": {
        const delivery = route.linkDelivery ?? "sms";
        const deliveryLine =
          delivery === "email"
            ? "I'll say the address, then email the maps link if they want it."
            : delivery === "both"
              ? "I'll say the address, then ask if they want the maps link by text or email."
              : "I'll say the address, then text the maps link if they want it.";
        will.push(deliveryLine);
        break;
      }
      case "send_link": {
        if (route.templateId === "booking-inquiry") {
          const delivery = route.linkDelivery ?? "sms";
          const deliveryLine =
            delivery === "email"
              ? "I'll offer the booking link, then email it if they want it."
              : delivery === "both"
                ? "I'll offer the booking link, then ask if they want it by text or email."
                : "I'll offer the booking link, then text it if they want it.";
          will.push(deliveryLine);
          break;
        }
        will.push(
          destination && destination !== "Add a link"
            ? `I'll text them the link (${destination}).`
            : `I'll text them the link you chose.`,
        );
        break;
      }
      case "send_file": {
        const file = sendableFiles.find((f) => f.id === route.businessFileId);
        will.push(
          file
            ? `I'll text them the file “${file.fileName}”.`
            : `I'll text them the file you attached.`,
        );
        break;
      }
      case "transfer":
        will.push(
          route.transferDuringHoursOnly
            ? `I'll try to put them through during opening hours only — otherwise I'll take a message.`
            : `I'll try to put them through to your team — if no answer, I'll take a message.`,
        );
        break;
      case "take_message":
        will.push(`I'll take a message and add it to your Action Inbox.`);
        break;
      default:
        will.push(actionDetail);
    }
  }

  if (rules && !isDefaultInboxNote(rules) && bookingMethod !== "callback") {
    will.push(`I'll follow your rules: ${rules}`);
  }

  const wont: string[] = [
    `I won't use this for general questions — services, hours, and FAQs stay in Cara Setup.`,
  ];

  if (bookingMethod === "callback" || bookingMethod === "both") {
    wont.push(
      `I won't confirm a slot, deposit, or appointment — I only capture what they want and your team follows up.`,
    );
  }

  switch (action) {
    case "directions":
      wont.push(`I won't skip saying the address — I say it first, then offer to send the link.`);
      wont.push(`I won't read a long URL out loud unless they ask — I'll text or email it.`);
      break;
    case "send_link":
      if (bookingMethod !== "both") {
        wont.push(`I won't book or change anything on the website for them — I only send the link.`);
      }
      if (route.templateId === "booking-inquiry" || bookingMethod === "both") {
        wont.push(`I won't read a long URL out loud unless they ask — I'll text or email it.`);
      } else {
        wont.push(`I won't read a long URL out loud unless they ask — I'll text it.`);
      }
      break;
    case "send_file":
      wont.push(`I won't email the file — I'll text it if their line supports SMS.`);
      break;
    case "transfer":
      wont.push(`I won't keep ringing if no one picks up — I'll take a message instead.`);
      break;
    case "take_message":
      if (bookingMethod !== "callback") {
        wont.push(`I won't promise a price, date, or callback time — I capture what they need.`);
      }
      break;
    default:
      break;
  }

  return { will, wont };
}

function isDefaultInboxNote(note: string): boolean {
  const n = note.toLowerCase();
  return (
    n.includes("capture their name") &&
    n.includes("phone number") &&
    n.includes("what they need")
  );
}
