import type { RouteOutcomeKind } from "./route-models";

export type RouteTemplate = {
  id: string;
  label: string;
  description: string;
  outcome: RouteOutcomeKind;
  defaultName: string;
};

/** Locked fallback — not shown in the add-route picker. */
export const FALLBACK_TEMPLATE_ID = "anything-else";

/** Options shown under “Cara decides” when adding a route. */
export const ROUTE_TEMPLATES: RouteTemplate[] = [
  {
    id: "booking-inquiry",
    label: "Booking or appointment",
    description: "Send a booking or scheduling link.",
    outcome: "send_link",
    defaultName: "Booking or appointment",
  },
  {
    id: "form-application",
    label: "Form or application",
    description: "Finance form, intake, quote form, etc.",
    outcome: "send_link",
    defaultName: "Form or application",
  },
  {
    id: "location",
    label: "Location or directions",
    description:
      "Texts a maps link (Call Flow). FAQs like “where are you?” → Cara Setup.",
    outcome: "send_link",
    defaultName: "Location or directions",
  },
  {
    id: "brochure",
    label: "Brochure or price list",
    description: "Send a file uploaded in Cara Setup.",
    outcome: "send_file",
    defaultName: "Brochure or price list",
  },
  {
    id: "quote-callback",
    label: "Quote or callback",
    description: "Capture details for your team.",
    outcome: "action_inbox",
    defaultName: "Quote or callback",
  },
  {
    id: "urgent",
    label: "Urgent help",
    description: "Time-sensitive — goes to Action Inbox.",
    outcome: "action_inbox",
    defaultName: "Urgent help",
  },
  {
    id: FALLBACK_TEMPLATE_ID,
    label: "Anything else",
    description: "Fallback when nothing else matches — take a message.",
    outcome: "action_inbox",
    defaultName: "Anything else",
  },
  {
    id: "general",
    label: "General enquiry",
    description: "Legacy — use Anything else instead.",
    outcome: "action_inbox",
    defaultName: "General enquiry",
  },
  {
    id: "cant-answer",
    label: "Can't answer",
    description: "Cara couldn't help — Action Inbox.",
    outcome: "action_inbox",
    defaultName: "Can't answer",
  },
  {
    id: "email",
    label: "Email request",
    description: "Uses your notification email from Settings.",
    outcome: "email",
    defaultName: "Email request",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Uses your notification phone from Settings.",
    outcome: "whatsapp",
    defaultName: "WhatsApp",
  },
  {
    id: "transfer",
    label: "Transfer to team",
    description: "Put the caller through to your transfer number.",
    outcome: "transfer",
    defaultName: "Speak to someone",
  },
  {
    id: "speak-to-person",
    label: "Speak to a person",
    description: "Built-in — transfer or take a message.",
    outcome: "transfer",
    defaultName: "Speak to a person",
  },
];

export const ROUTE_TEMPLATE_BY_ID = new Map(
  ROUTE_TEMPLATES.map((t) => [t.id, t]),
);

/**
 * What Cara actually does for a thing customers call about. This is the simple,
 * owner-facing choice shown in the editor — it maps onto a route template +
 * outcome under the hood (so the persisted worker contract is unchanged).
 */
export type RouteActionType =
  | "send_link"
  | "send_file"
  | "directions"
  | "take_message"
  | "email"
  | "whatsapp"
  | "transfer";

export type RouteActionTypeMeta = {
  id: RouteActionType;
  /** Maps to the underlying route template (semantics: location, file, etc.). */
  templateId: string;
  outcome: RouteOutcomeKind;
  /** Button label in the action chooser. */
  label: string;
  /** "Cara <verb>" — used in the route card summary. */
  verb: string;
  /** One-line, owner-facing description of what this does. */
  description: string;
};

/** Order shown in the editor's action chooser. */
export const ROUTE_ACTION_TYPES: RouteActionTypeMeta[] = [
  {
    id: "send_link",
    templateId: "form-application",
    outcome: "send_link",
    label: "Send a link",
    verb: "texts a link",
    description: "Text a booking page, form, or any web link.",
  },
  {
    id: "send_file",
    templateId: "brochure",
    outcome: "send_file",
    label: "Send a file",
    verb: "sends a file",
    description: "Send a menu, price list, or brochure you've uploaded.",
  },
  {
    id: "directions",
    templateId: "location",
    outcome: "send_link",
    label: "Send directions",
    verb: "texts directions",
    description: "Text your address as a Google Maps link.",
  },
  {
    id: "take_message",
    templateId: "quote-callback",
    outcome: "action_inbox",
    label: "Take a message",
    verb: "takes a message",
    description: "Capture details for your team to follow up.",
  },
  {
    id: "email",
    templateId: "email",
    outcome: "email",
    label: "Email team",
    verb: "emails your team",
    description: "Send the request to your notification email.",
  },
  {
    id: "whatsapp",
    templateId: "whatsapp",
    outcome: "whatsapp",
    label: "WhatsApp",
    verb: "messages on WhatsApp",
    description: "Follow up on your WhatsApp number.",
  },
  {
    id: "transfer",
    templateId: "transfer",
    outcome: "transfer",
    label: "Transfer call",
    verb: "tries to put them through",
    description: "Ring your team — if no answer, take a message.",
  },
];

export const ROUTE_ACTION_TYPE_BY_ID = new Map(
  ROUTE_ACTION_TYPES.map((a) => [a.id, a]),
);

/** Input the editor sends when asking AI to suggest a clear, caller-facing name. */
export type RouteNameSuggestionInput = {
  actionType: RouteActionType;
  url?: string;
  fileName?: string;
  currentName?: string;
  /** Existing route names so the suggestion stays distinct. */
  existingNames?: string[];
};

export type RouteNameSuggestion = { name: string; label?: string };

export type SuggestRouteNameResult =
  | ({ ok: true } & RouteNameSuggestion)
  | { ok: false };

/** Surface-specific server action the editor calls for AI naming (optional). */
export type SuggestRouteNameFn = (
  input: RouteNameSuggestionInput,
) => Promise<SuggestRouteNameResult>;
