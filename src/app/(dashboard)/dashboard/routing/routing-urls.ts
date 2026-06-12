import type { RoutingLink } from "./routing-links";
import { MAX_ROUTING_FIELD_LEN } from "./routing-links";

export const MAX_ROUTING_URLS_PER_PRESET = 5;
export const MAX_LINK_LABEL_LEN = 80;

/** Named link Cara can match to what the caller asks for. */
export type RoutingLinkDestination = {
  label: string;
  url: string;
};

function trimDestination(d: RoutingLinkDestination): RoutingLinkDestination {
  return {
    label: d.label.trim().slice(0, MAX_LINK_LABEL_LEN),
    url: d.url.trim().slice(0, MAX_ROUTING_FIELD_LEN),
  };
}

export function isCompleteLinkDestination(d: RoutingLinkDestination): boolean {
  return Boolean(d.label.trim() && d.url.trim());
}

/** Read destinations from `links`, legacy `urls`, or newline `url`. */
type RoutingLinkDestinationsSource = Pick<RoutingLink, "url" | "urls" | "links"> & {
  label?: string | null;
};

export function getRoutingLinkDestinations(
  link: RoutingLinkDestinationsSource,
): RoutingLinkDestination[] {
  const fallbackLabel = typeof link.label === "string" ? link.label.trim() : "";
  if (Array.isArray(link.links)) {
    return link.links
      .map((row) => ({
        label: typeof row?.label === "string" ? row.label : "",
        url: typeof row?.url === "string" ? row.url : "",
      }))
      .slice(0, MAX_ROUTING_URLS_PER_PRESET);
  }

  const legacyUrls: string[] = [];
  if (Array.isArray(link.urls)) {
    legacyUrls.push(
      ...link.urls
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter(Boolean),
    );
  } else {
    const raw = link.url.trim();
    if (raw.includes("\n")) {
      legacyUrls.push(
        ...raw
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      );
    } else if (raw) {
      legacyUrls.push(raw);
    }
  }

  return legacyUrls.slice(0, MAX_ROUTING_URLS_PER_PRESET).map((url, index) => ({
    label: legacyUrls.length > 1 ? `Link ${index + 1}` : fallbackLabel,
    url,
  }));
}

/** Persist destinations on save (complete rows only). */
export function applyRoutingLinkDestinations(
  destinations: RoutingLinkDestination[],
): Pick<RoutingLink, "url" | "urls" | "links"> {
  const cleaned = destinations
    .map(trimDestination)
    .filter(isCompleteLinkDestination)
    .slice(0, MAX_ROUTING_URLS_PER_PRESET);

  return {
    links: cleaned.length > 0 ? cleaned : null,
    urls: cleaned.length > 0 ? cleaned.map((d) => d.url) : null,
    url: cleaned[0]?.url ?? "",
  };
}

export function hasRoutingLinkDestination(link: RoutingLinkDestinationsSource): boolean {
  return getRoutingLinkDestinations(link).some(isCompleteLinkDestination);
}

export function formatDestinationsSummary(
  destinations: RoutingLinkDestination[],
): string {
  const complete = destinations.filter(isCompleteLinkDestination);
  if (complete.length === 0) return "Add names and links";
  if (complete.length === 1) {
    const name = complete[0]!.label;
    return name.length > 32 ? `${name.slice(0, 31)}…` : name;
  }
  const names = complete.map((d) => d.label).join(", ");
  return names.length > 40 ? `${complete.length} links` : names;
}
