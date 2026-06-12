import type { RoutingLink, RoutingTargetType } from "./routing-links";

/** Plain-English actions shown in the UI (maps to existing targetType values). */
type OwnerRouteAction =
  | "text_link"
  | "send_file"
  | "take_message"
  | "email_request"
  | "send_whatsapp"
  | "just_log";

function targetTypeToOwnerAction(type: RoutingTargetType): OwnerRouteAction {
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

function formatRouteListTitle(intent: string, label?: string): string {
  const raw = intent.trim() || label?.trim() || "";
  if (!raw) return "New route";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
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
