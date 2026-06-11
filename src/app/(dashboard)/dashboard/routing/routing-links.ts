/**
 * Universal routing: where Cara sends callers depending on intent.
 */
export type RoutingTargetType =
  | "link"
  | "form"
  | "callback"
  | "email"
  | "phone"
  | "whatsapp"
  | "note";

export const ROUTING_TARGET_TYPES: { value: RoutingTargetType; label: string }[] = [
  { value: "link", label: "Link" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "callback", label: "Callback" },
  { value: "form", label: "Form" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "note", label: "Internal note" },
];

const ROUTING_TARGET_VALUES = new Set<string>(
  ROUTING_TARGET_TYPES.map((t) => t.value),
);

export function isRoutingTargetType(v: unknown): v is RoutingTargetType {
  return typeof v === "string" && ROUTING_TARGET_VALUES.has(v);
}

export type RoutingLink = {
  id: string;
  /** Fixed catalog id when this row comes from Routing presets. */
  presetId?: string | null;
  label: string;
  intent: string;
  targetType: RoutingTargetType;
  url: string;
  /** Named links for multi-link presets (worker matches caller request to `label`). */
  links?: Array<{ label: string; url: string }> | null;
  /** URL list kept in sync for older workers; prefer `links`. */
  urls?: string[] | null;
  /** When `targetType` is `form` (send file), references `business_files.id`. */
  businessFileId?: string | null;
  active: boolean;
  /** Transfer route: only attempt during opening hours. */
  transferDuringHoursOnly?: boolean;
  /** Spoken / named transfer target for per-route transfers. */
  transferLabel?: string | null;
  /** Phrases callers say out loud — Cara matches on these (comma-separated). */
  keywords?: string | null;
  /** Instructions for Cara when this route applies (not shown to callers). */
  description?: string | null;
};

export const MAX_ROUTING_LINKS = 25;
export const MAX_ROUTING_FIELD_LEN = 500;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Tolerant parse of the organizations.routing_links jsonb column. */
export function parseRoutingLinks(raw: unknown): RoutingLink[] {
  if (!Array.isArray(raw)) return [];
  const out: RoutingLink[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const label = typeof entry.label === "string" ? entry.label : "";
    const intent = typeof entry.intent === "string" ? entry.intent : "";
    const url = typeof entry.url === "string" ? entry.url : "";
    let targetType: RoutingTargetType = "link";
    if (isRoutingTargetType(entry.targetType)) {
      targetType = entry.targetType;
    }
    const active = entry.active === false ? false : true;
    const businessFileId =
      typeof entry.businessFileId === "string" && entry.businessFileId.trim()
        ? entry.businessFileId.trim()
        : null;
    const presetId =
      typeof entry.presetId === "string" && entry.presetId.trim()
        ? entry.presetId.trim()
        : null;
    const id =
      typeof entry.id === "string" && entry.id.trim()
        ? entry.id
        : presetId
          ? `preset_${presetId}`
          : `route_${out.length}`;
    let links: Array<{ label: string; url: string }> | null = null;
    if (Array.isArray(entry.links)) {
      links = entry.links
        .map((row) => {
          if (typeof row !== "object" || row === null) return null;
          const r = row as Record<string, unknown>;
          const l = typeof r.label === "string" ? r.label.trim() : "";
          const u = typeof r.url === "string" ? r.url.trim() : "";
          if (!l && !u) return null;
          return {
            label: l.slice(0, 80),
            url: u.slice(0, MAX_ROUTING_FIELD_LEN),
          };
        })
        .filter((row): row is { label: string; url: string } => row !== null);
      if (links.length === 0) links = null;
    }
    let urls: string[] | null = null;
    if (Array.isArray(entry.urls)) {
      urls = entry.urls
        .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        .map((u) => u.trim().slice(0, MAX_ROUTING_FIELD_LEN));
    }
    if (
      !label &&
      !intent &&
      !url &&
      !businessFileId &&
      (!urls || urls.length === 0) &&
      (!links || links.length === 0)
    ) {
      continue;
    }
    const transferDuringHoursOnly =
      entry.transferDuringHoursOnly === true ? true : undefined;
    const transferLabel =
      typeof entry.transferLabel === "string" && entry.transferLabel.trim()
        ? entry.transferLabel.trim()
        : null;
    const keywords =
      typeof entry.keywords === "string" && entry.keywords.trim()
        ? entry.keywords.trim().slice(0, MAX_ROUTING_FIELD_LEN)
        : null;
    const description =
      typeof entry.description === "string" && entry.description.trim()
        ? entry.description.trim().slice(0, MAX_ROUTING_FIELD_LEN)
        : null;
    out.push({
      id,
      presetId,
      label,
      intent,
      targetType,
      url,
      links,
      urls,
      businessFileId,
      active,
      ...(transferDuringHoursOnly ? { transferDuringHoursOnly } : {}),
      ...(transferLabel ? { transferLabel } : {}),
      ...(keywords ? { keywords } : {}),
      ...(description ? { description } : {}),
    });
  }
  return out;
}
