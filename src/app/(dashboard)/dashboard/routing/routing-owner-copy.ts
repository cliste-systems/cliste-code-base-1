import type { RoutingLink, RoutingTargetType } from "./routing-links";
import {
  formatDestinationsSummary,
  getRoutingLinkDestinations,
  hasRoutingLinkDestination,
  isCompleteLinkDestination,
} from "./routing-urls";

/** Plain-English actions shown in the UI (maps to existing targetType values). */
export type OwnerRouteAction =
  | "text_link"
  | "send_file"
  | "take_message"
  | "email_request"
  | "send_whatsapp"
  | "just_log";

export const OWNER_ROUTE_ACTIONS: {
  id: OwnerRouteAction;
  label: string;
}[] = [
  { id: "text_link", label: "Text them a link" },
  { id: "send_file", label: "Send them a file" },
  { id: "take_message", label: "Take a message" },
  { id: "email_request", label: "Email the request" },
  { id: "send_whatsapp", label: "Send on WhatsApp" },
  { id: "just_log", label: "Just log it" },
];

export type OwnerActionFieldConfig = {
  label: string;
  placeholder: string;
  helper: string;
  multiline?: boolean;
  optional?: boolean;
  showFileLinkNotice?: boolean;
};

export const OWNER_ACTION_FIELD: Record<OwnerRouteAction, OwnerActionFieldConfig> = {
  text_link: {
    label: "Link to send",
    placeholder: "https://…",
    helper:
      "Use this for forms, booking pages, price pages, directions, or any page callers should open.",
  },
  send_file: {
    label: "File to send",
    placeholder: "",
    helper: "Upload files in Cara Setup and mark them as “Send to callers”.",
  },
  take_message: {
    label: "Message instructions",
    placeholder:
      "Ask for their name, phone number, what they need, and how urgent it is.",
    helper: "Cara will add this to the Action Inbox.",
    multiline: true,
    optional: true,
  },
  email_request: {
    label: "Email address",
    placeholder: "team@business.com",
    helper: "Cara will send the caller’s details and request to this email.",
  },
  send_whatsapp: {
    label: "WhatsApp number or link",
    placeholder: "+353… or https://wa.me/…",
    helper: "Cara will send or prepare the follow-up through WhatsApp.",
  },
  just_log: {
    label: "Internal note",
    placeholder: "Record the request in the call log only.",
    helper: "Use this when Cara should record the call but no follow-up is needed.",
    multiline: true,
    optional: true,
  },
};

export const TRIGGER_SUGGESTIONS = [
  "prices or quotes",
  "booking or appointment",
  "urgent help",
  "new enquiries",
  "opening hours",
  "location or directions",
  "anything else",
];

export function targetTypeToOwnerAction(type: RoutingTargetType): OwnerRouteAction {
  switch (type) {
    case "form":
      return "send_file";
    case "phone":
      return "take_message";
    case "callback":
      return "take_message";
    case "email":
      return "email_request";
    case "whatsapp":
      return "send_whatsapp";
    case "note":
      return "just_log";
    case "link":
    default:
      return "text_link";
  }
}

export function ownerActionToTargetType(action: OwnerRouteAction): RoutingTargetType {
  switch (action) {
    case "send_file":
      return "form";
    case "take_message":
      return "callback";
    case "email_request":
      return "email";
    case "send_whatsapp":
      return "whatsapp";
    case "just_log":
      return "note";
    case "text_link":
    default:
      return "link";
  }
}

export function ownerActionLabel(action: OwnerRouteAction): string {
  return OWNER_ROUTE_ACTIONS.find((a) => a.id === action)?.label ?? "Text them a link";
}

export function formatRouteListTitle(intent: string, label?: string): string {
  const raw = intent.trim() || label?.trim() || "";
  if (!raw) return "New route";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatTriggerForPreview(trigger: string): string {
  const t = trigger.trim();
  if (!t) return "…";
  return t.toLowerCase();
}

export function listRowSubtitle(action: OwnerRouteAction): string {
  switch (action) {
    case "text_link":
      return "Cara will text them a link.";
    case "send_file":
      return "Cara will send them a file.";
    case "take_message":
      return "Cara will take a message.";
    case "email_request":
      return "Cara will email the request.";
    case "send_whatsapp":
      return "Cara will send on WhatsApp.";
    case "just_log":
      return "Cara will just log it.";
    default:
      return "Cara will follow this route.";
  }
}

export function buildRoutePreviewSentence(
  trigger: string,
  action: OwnerRouteAction,
  sendableFileName?: string | null,
): string {
  const topic = formatTriggerForPreview(trigger);
  if (!trigger.trim()) {
    return "When a caller asks about something specific, Cara will follow this route.";
  }
  const filePhrase = sendableFileName?.trim()
    ? `your ${sendableFileName.trim().toLowerCase()}`
    : "the selected file";
  switch (action) {
    case "text_link":
      return `When a caller asks about ${topic}, Cara will text them your link.`;
    case "send_file":
      return `When a caller asks about ${topic}, Cara will send them ${filePhrase}.`;
    case "take_message":
      return `When a caller asks about ${topic}, Cara will take a message.`;
    case "email_request":
      return `When a caller asks about ${topic}, Cara will email the request.`;
    case "send_whatsapp":
      return `When a caller asks about ${topic}, Cara will send on WhatsApp.`;
    case "just_log":
      return `When a caller asks about ${topic}, Cara will log it for your records.`;
    default:
      return `When a caller asks about ${topic}, Cara will follow this route.`;
  }
}

export function syncLinkFromTrigger(trigger: string): Pick<RoutingLink, "intent" | "label"> {
  const intent = trigger.trim();
  return {
    intent,
    label: formatRouteListTitle(intent),
  };
}

export function normalizeRoutingLink(link: RoutingLink): RoutingLink {
  const intent = link.intent.trim();
  const label = intent ? formatRouteListTitle(intent) : link.label.trim();
  const targetType: RoutingTargetType =
    link.presetId === "transfer"
      ? "phone"
      : link.targetType === "phone"
        ? "callback"
        : link.targetType;
  const action = targetTypeToOwnerAction(targetType);
  const businessFileId =
    action === "send_file" ? link.businessFileId?.trim() || null : null;
  return {
    ...link,
    intent,
    label: label || link.label.trim(),
    targetType,
    businessFileId,
    url: action === "send_file" ? "" : link.url.trim(),
  };
}

export function routeHasDraftContent(link: RoutingLink): boolean {
  return Boolean(
    link.intent.trim() ||
      link.label.trim() ||
      link.url.trim() ||
      link.businessFileId?.trim(),
  );
}

export function isDestinationRequired(
  action: OwnerRouteAction,
  link?: Pick<RoutingLink, "businessFileId" | "url">,
): boolean {
  if (action === "take_message" || action === "just_log") return false;
  if (action === "send_file") {
    return !link?.businessFileId?.trim();
  }
  if (action === "text_link" && link && hasRoutingLinkDestination(link)) {
    return false;
  }
  return !link?.url?.trim();
}

export function ownerDestinationSummary(
  link: RoutingLink,
  sendableFileName?: string | null,
): string {
  const destinations = getRoutingLinkDestinations(link);
  const complete = destinations.filter(isCompleteLinkDestination);
  if (complete.length > 0) {
    return formatDestinationsSummary(complete);
  }
  const action = targetTypeToOwnerAction(link.targetType);
  if (action === "send_file") {
    if (sendableFileName?.trim()) {
      const short =
        sendableFileName.length > 36
          ? `${sendableFileName.slice(0, 35)}…`
          : sendableFileName;
      return short;
    }
    return "Choose a file";
  }
  const dest = link.url.trim();
  if (!dest) {
    if (action === "take_message" || action === "just_log") {
      return listRowSubtitle(action);
    }
    return "Add details below";
  }
  const short = dest.length > 36 ? `${dest.slice(0, 35)}…` : dest;
  return short;
}
