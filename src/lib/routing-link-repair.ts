import {
  FALLBACK_TEMPLATE_ID,
} from "@/app/(dashboard)/dashboard/routing/route-templates";
import type { RoutingLink } from "@/app/(dashboard)/dashboard/routing/routing-links";
import {
  isRouteDestinationUrl,
  looksLikeCaptureProse,
} from "@/app/(dashboard)/dashboard/routing/routing-validation";

const INBOX_TARGET_TYPES = new Set(["callback", "note", "phone"]);

function isFallbackLink(link: RoutingLink): boolean {
  const preset = String(link.presetId ?? "").trim();
  return (
    preset === FALLBACK_TEMPLATE_ID ||
    preset === "general" ||
    preset === "anything-else"
  );
}

function isLinkTargetRoute(link: RoutingLink): boolean {
  if (link.targetType === "link") return true;
  const preset = String(link.presetId ?? "").trim();
  return preset === "booking-inquiry" || preset === "form-application";
}

/**
 * One-time repair: link routes must not store capture prose in `url`.
 * Inbox/fallback rows may keep prose in `url` (worker contract).
 */
export function repairCorruptedRoutingLinks(links: RoutingLink[]): RoutingLink[] {
  if (!links.length) return links;

  let capturedProse: string | null = null;
  const repaired = links.map((link) => {
    const url = link.url.trim();
    if (!url || isRouteDestinationUrl(url) || INBOX_TARGET_TYPES.has(link.targetType)) {
      return link;
    }
    if (!isLinkTargetRoute(link)) {
      return link;
    }
    if (looksLikeCaptureProse(url)) {
      capturedProse = capturedProse ?? url;
      return { ...link, url: "" };
    }
    return { ...link, url: "" };
  });

  if (!capturedProse) return repaired;

  return repaired.map((link) => {
    if (!isFallbackLink(link)) return link;
    const existing = link.url.trim();
    if (existing && existing !== "Take a message for the team") {
      return link;
    }
    return { ...link, url: capturedProse! };
  });
}
