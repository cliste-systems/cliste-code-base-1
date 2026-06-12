import type { BusinessFileListItem } from "@/lib/business-files";

import {
  isFallbackRoute,
  routeSummary,
  type SavedRoute,
} from "./route-models";

export function describeRouteAction(
  route: SavedRoute,
  sendableFiles: BusinessFileListItem[],
): string {
  switch (route.outcome) {
    case "send_link": {
      const url = route.url.trim();
      return url ? `Text link: ${url}` : "Text link (finish setup)";
    }
    case "send_file": {
      const file = sendableFiles.find((f) => f.id === route.businessFileId);
      return file ? `Text file: ${file.fileName}` : "Text file (choose in Setup)";
    }
    case "transfer":
      return route.transferDuringHoursOnly
        ? "Transfer during opening hours — otherwise take a message"
        : "Try to put them through — if no answer, take a message";
    case "action_inbox":
      return isFallbackRoute(route)
        ? "Take a message (Action Inbox)"
        : "Action Inbox — capture details for your team";
    case "email":
      return route.email.trim()
        ? `Collect details → email ${route.email.trim()}`
        : "Email request (add address in Settings)";
    case "whatsapp":
      return route.whatsapp.trim()
        ? "Hand off to WhatsApp"
        : "WhatsApp (add number in Settings)";
    default:
      return routeSummary(route);
  }
}
