import {
  dedupeCaraSetupChips,
  normalizeCaraSetupChip,
} from "@/lib/cara-setup-chips";

import { validateRouteUrl } from "./routing-validation";
import type { RoutingLink } from "./routing-links";
import {
  getRoutingLinkDestinations,
  isCompleteLinkDestination,
} from "./routing-urls";
import {
  FALLBACK_TEMPLATE_ID,
  ROUTE_TEMPLATE_BY_ID,
  type RouteActionType,
  type RouteTemplate,
} from "./route-templates";

export const FALLBACK_ROUTE_ID = "route_fallback";
export const BUILTIN_SPEAK_TO_PERSON_ID = "builtin_speak_to_person";
export const SPEAK_TO_PERSON_TEMPLATE_ID = "speak-to-person";

export type RouteKind = "builtin" | "custom";

const FALLBACK_INBOX_NOTE =
  "Take a message — capture their name, phone number, and what they need so nothing is lost.";

export type RouteOutcomeKind =
  | "send_link"
  | "send_file"
  | "action_inbox"
  | "email"
  | "whatsapp"
  | "transfer";

/**
 * One route = one internal label (`name`) + caller phrases (`keywords`) Cara
 * matches on + one action (`outcome`) + one destination. Multiple links are
 * modelled as separate routes, each with its own keywords.
 */
export type SavedRoute = {
  id: string;
  templateId: string;
  kind?: RouteKind;
  builtinId?: "speak_to_person";
  /** Owner-facing label in the dashboard — Cara does not match on this. */
  name: string;
  /** Phrases callers say out loud — Cara matches on these (comma-separated). */
  keywords: string;
  outcome: RouteOutcomeKind;
  active: boolean;
  /** Single destination URL for send_link / directions. */
  url: string;
  businessFileId: string | null;
  email: string;
  whatsapp: string;
  note: string;
  /** Per-route transfer target (defaults to account number when empty). */
  transferNumber?: string;
  /** Spoken name for transfer target, e.g. "the service desk". */
  transferLabel?: string;
  /** When true, transfer only during opening hours — otherwise take a message. */
  transferDuringHoursOnly?: boolean;
  /** Instructions for Cara when this route applies. */
  description?: string;
};

/** Split stored keywords into individual phrases (comma/semicolon separated). */
export function parseRouteKeywordList(keywords: string): string[] {
  return dedupeCaraSetupChips(
    keywords
      .split(/[,;]/)
      .map((part) => normalizeCaraSetupChip(part))
      .filter(Boolean),
  );
}

/** Persist keyword chips as a comma-separated string. */
export function formatRouteKeywordList(items: string[]): string {
  return dedupeCaraSetupChips(items).join(", ");
}

/** Caller phrases Cara listens for — falls back to legacy `name` when unset. */
export function routeKeywords(
  route: Pick<SavedRoute, "keywords" | "name">,
): string {
  const parsed = parseRouteKeywordList(route.keywords ?? "");
  if (parsed.length > 0) return parsed.join(", ");
  return route.name.trim();
}

function primaryIntentPhrase(keywords: string): string {
  const first = keywords.split(/[,;]/)[0]?.trim();
  return (first || keywords).toLowerCase();
}

const DEFAULT_INBOX_NOTE =
  "Capture their name, phone number, what they need, and how soon they need a reply.";

function newRouteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `route_${crypto.randomUUID()}`;
  }
  return `route_${Math.random().toString(36).slice(2, 10)}`;
}

export function createRouteFromTemplate(template: RouteTemplate): SavedRoute {
  return {
    id: newRouteId(),
    templateId: template.id,
    name: "",
    keywords: "",
    outcome: template.outcome,
    active: true,
    url: "",
    businessFileId: null,
    email: "",
    whatsapp: "",
    note: "",
  };
}

export function isFallbackRoute(route: Pick<SavedRoute, "templateId">): boolean {
  return (
    route.templateId === FALLBACK_TEMPLATE_ID || route.templateId === "general"
  );
}

export function isSpeakToPersonBuiltin(
  route: Pick<SavedRoute, "id" | "builtinId" | "templateId">,
): boolean {
  return (
    route.id === BUILTIN_SPEAK_TO_PERSON_ID ||
    route.builtinId === "speak_to_person" ||
    route.templateId === SPEAK_TO_PERSON_TEMPLATE_ID
  );
}

export function isCustomRoute(route: SavedRoute): boolean {
  return (
    !isFallbackRoute(route) &&
    !isSpeakToPersonBuiltin(route) &&
    (route.kind === "custom" || route.kind === undefined)
  );
}

export function createSpeakToPersonBuiltin(): SavedRoute {
  return {
    id: BUILTIN_SPEAK_TO_PERSON_ID,
    templateId: SPEAK_TO_PERSON_TEMPLATE_ID,
    kind: "builtin",
    builtinId: "speak_to_person",
    name: "Speak to a person",
    keywords: "speak to someone, speak to a person, talk to someone",
    outcome: "transfer",
    active: true,
    url: "",
    businessFileId: null,
    email: "",
    whatsapp: "",
    note: "",
    transferDuringHoursOnly: false,
  };
}

export function customRoutes(routes: SavedRoute[]): SavedRoute[] {
  return routes.filter(isCustomRoute);
}

/** The owner-facing action type for a saved route (drives the editor chooser). */
export function routeActionType(
  route: Pick<SavedRoute, "templateId" | "outcome">,
): RouteActionType {
  if (route.templateId === "location") return "directions";
  switch (route.outcome) {
    case "send_file":
      return "send_file";
    case "email":
      return "email";
    case "whatsapp":
      return "whatsapp";
    case "transfer":
      return "transfer";
    case "action_inbox":
      return "take_message";
    case "send_link":
    default:
      return "send_link";
  }
}

export function createFallbackRoute(): SavedRoute {
  return {
    id: FALLBACK_ROUTE_ID,
    templateId: FALLBACK_TEMPLATE_ID,
    name: "Anything else",
    keywords: "",
    outcome: "action_inbox",
    active: true,
    url: "",
    businessFileId: null,
    email: "",
    whatsapp: "",
    note: FALLBACK_INBOX_NOTE,
  };
}

export function sortRoutesWithFallbackLast(routes: SavedRoute[]): SavedRoute[] {
  const custom = routes.filter(isCustomRoute);
  const builtin = routes.filter(isSpeakToPersonBuiltin);
  const fallback = routes.filter(isFallbackRoute);
  return [...custom, ...builtin, ...fallback];
}

/** Move a route before another (fallback stays last). */
export function reorderRoutes(
  routes: SavedRoute[],
  draggedId: string,
  beforeId: string,
): SavedRoute[] {
  if (draggedId === beforeId) return routes;
  const ordered = sortRoutesWithFallbackLast(routes);
  const from = ordered.findIndex((r) => r.id === draggedId);
  const to = ordered.findIndex((r) => r.id === beforeId);
  if (from < 0 || to < 0) return routes;
  if (
    isFallbackRoute(ordered[from]) ||
    isFallbackRoute(ordered[to]) ||
    isSpeakToPersonBuiltin(ordered[from]) ||
    isSpeakToPersonBuiltin(ordered[to])
  ) {
    return routes;
  }

  const next = [...ordered];
  const [item] = next.splice(from, 1);
  const insertAt = from < to ? to - 1 : to;
  next.splice(insertAt, 0, item);
  return next;
}

/** Ensures fallback + built-in speak-to-person exist; preserves custom route order. */
export function ensureAccountRoutes(routes: SavedRoute[]): SavedRoute[] {
  const withFallback = ensureFallbackRoute(routes);
  const custom = withFallback.filter(isCustomRoute);
  const fallback = withFallback.find(isFallbackRoute)!;
  const existingBuiltin = withFallback.find(isSpeakToPersonBuiltin);
  const builtin = existingBuiltin
    ? {
        ...createSpeakToPersonBuiltin(),
        ...existingBuiltin,
        id: BUILTIN_SPEAK_TO_PERSON_ID,
        kind: "builtin" as const,
        builtinId: "speak_to_person" as const,
        templateId: SPEAK_TO_PERSON_TEMPLATE_ID,
      }
    : createSpeakToPersonBuiltin();
  return [...custom.map((r) => ({ ...r, kind: "custom" as const })), builtin, fallback];
}

/** @deprecated Use ensureAccountRoutes */
export function ensureFallbackRoute(routes: SavedRoute[]): SavedRoute[] {
  const normalized = routes.map((r) => {
    if (r.templateId !== "general") return r;
    return {
      ...r,
      templateId: FALLBACK_TEMPLATE_ID,
      name: r.name.trim() || "Anything else",
      note: r.note.trim() || FALLBACK_INBOX_NOTE,
    };
  });

  const existing = normalized.find(isFallbackRoute);
  if (existing) {
    const merged: SavedRoute = {
      ...createFallbackRoute(),
      ...existing,
      id: FALLBACK_ROUTE_ID,
      templateId: FALLBACK_TEMPLATE_ID,
      name: existing.name.trim() || "Anything else",
      note: existing.note.trim() || FALLBACK_INBOX_NOTE,
      active: true,
    };
    const rest = normalized.filter((r) => !isFallbackRoute(r));
    return sortRoutesWithFallbackLast([...rest, merged]);
  }

  return sortRoutesWithFallbackLast([...normalized, createFallbackRoute()]);
}

function truncateMiddle(text: string, max = 42): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${t.slice(0, head)}…${t.slice(-tail)}`;
}

/** Short label for route cards — never dumps a full URL inline. */
export function routeDestinationLabel(route: SavedRoute): string {
  switch (route.outcome) {
    case "send_link": {
      const url = route.url.trim();
      if (!url) return "Add a link";
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        return host || truncateMiddle(url);
      } catch {
        return truncateMiddle(url);
      }
    }
    case "send_file":
      return route.businessFileId ? "File attached" : "Choose a file";
    case "transfer":
      return "Transfer to team";
    case "action_inbox":
      return isFallbackRoute(route) ? "Take a message" : "Action Inbox";
    case "email":
      return route.email.trim() || "Add email";
    case "whatsapp":
      return route.whatsapp.trim() || "Add WhatsApp";
    default:
      return "";
  }
}

export function routeSummary(route: SavedRoute): string {
  return routeDestinationLabel(route);
}

export function routeNeedsSetup(route: SavedRoute): boolean {
  if (!route.active) return false;
  switch (route.outcome) {
    case "send_link":
      return !route.url.trim();
    case "send_file":
      return !route.businessFileId?.trim();
    case "email":
      return !route.email.trim();
    case "whatsapp":
      return !route.whatsapp.trim();
    case "transfer":
      return false;
    case "action_inbox":
      return false;
    default:
      return false;
  }
}

function outcomeToTargetType(outcome: RouteOutcomeKind): RoutingLink["targetType"] {
  switch (outcome) {
    case "send_file":
      return "form";
    case "action_inbox":
      return "callback";
    case "email":
      return "email";
    case "whatsapp":
      return "whatsapp";
    case "transfer":
      return "phone";
    case "send_link":
    default:
      return "link";
  }
}

/**
 * Persisted shape for the voice worker — exactly one flat row per saved route.
 * `label` is the owner's internal name; `keywords`/`intent` are what callers say.
 */
export function serializeRoutes(routes: SavedRoute[]): RoutingLink[] {
  const out: RoutingLink[] = [];

  for (const route of routes) {
    if (!route.active) continue;

    const keywords = routeKeywords(route);
    const intent = primaryIntentPhrase(keywords);
    const targetType = outcomeToTargetType(route.outcome);
    const base: RoutingLink = {
      id: route.id,
      presetId: route.templateId,
      label:
        route.name.trim() ||
        keywords.split(/[,;]/)[0]?.trim() ||
        "Route",
      intent,
      targetType,
      url: "",
      links: null,
      urls: null,
      businessFileId: null,
      active: true,
      ...(keywords ? { keywords } : {}),
      ...(route.description?.trim()
        ? { description: route.description.trim() }
        : {}),
    };

    switch (route.outcome) {
      case "send_link": {
        const url = route.url.trim();
        if (url) out.push({ ...base, url });
        break;
      }
      case "send_file":
        out.push({ ...base, businessFileId: route.businessFileId });
        break;
      case "action_inbox":
        out.push({ ...base, url: route.note.trim() || DEFAULT_INBOX_NOTE });
        break;
      case "email":
        out.push({ ...base, url: route.email.trim() });
        break;
      case "whatsapp":
        out.push({ ...base, url: route.whatsapp.trim() });
        break;
      case "transfer": {
        const transferUrl =
          route.transferNumber?.trim() || route.note.trim() || "transfer";
        const transferMeta = {
          url: transferUrl,
          transferDuringHoursOnly: route.transferDuringHoursOnly === true,
          ...(route.transferLabel?.trim()
            ? { transferLabel: route.transferLabel.trim() }
            : {}),
        };
        if (isSpeakToPersonBuiltin(route)) {
          out.push({
            ...base,
            id: BUILTIN_SPEAK_TO_PERSON_ID,
            presetId: SPEAK_TO_PERSON_TEMPLATE_ID,
            label: "Speak to a person",
            intent: "speak to someone",
            ...transferMeta,
          });
        } else {
          out.push({
            ...base,
            presetId: "transfer",
            ...transferMeta,
          });
        }
        break;
      }
    }
  }

  return out;
}

function templateIdFromLink(link: RoutingLink): string {
  if (link.presetId === SPEAK_TO_PERSON_TEMPLATE_ID) {
    return SPEAK_TO_PERSON_TEMPLATE_ID;
  }
  if (link.presetId === "transfer") return "transfer";
  if (link.presetId && ROUTE_TEMPLATE_BY_ID.has(link.presetId)) {
    return link.presetId;
  }
  const intent = link.intent.toLowerCase();
  if (intent.includes("book")) return "booking-inquiry";
  if (intent.includes("location") || intent.includes("direction")) return "location";
  if (intent.includes("brochure") || intent.includes("price list")) return "brochure";
  if (intent.includes("urgent")) return "urgent";
  if (intent.includes("email")) return "email";
  if (intent.includes("whatsapp")) return "whatsapp";
  if (intent.includes("anything else") || intent.includes("general")) {
    return FALLBACK_TEMPLATE_ID;
  }
  if (link.targetType === "form") return "brochure";
  if (link.targetType === "email") return "email";
  if (link.targetType === "whatsapp") return "whatsapp";
  return "general";
}

function outcomeFromLink(link: RoutingLink): RouteOutcomeKind {
  switch (link.targetType) {
    case "form":
      return "send_file";
    case "email":
      return "email";
    case "whatsapp":
      return "whatsapp";
    case "phone":
      if (link.presetId === SPEAK_TO_PERSON_TEMPLATE_ID) return "transfer";
      return link.presetId === "transfer" ? "transfer" : "action_inbox";
    case "callback":
    case "note":
      return "action_inbox";
    case "link":
    default:
      return "send_link";
  }
}

function slugifyRouteId(label: string, index: number): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  return slug || `link_${index}`;
}

export function routesFromStoredLinks(links: RoutingLink[]): SavedRoute[] {
  const routes: SavedRoute[] = [];

  for (const link of links) {
    if (!link.active) continue;

    const outcome = outcomeFromLink(link);
    const templateId = templateIdFromLink(link);
    const template = ROUTE_TEMPLATE_BY_ID.get(templateId);
    const baseId = link.id || `route_${routes.length}`;

    if (outcome === "send_link") {
      const complete = getRoutingLinkDestinations(link).filter(
        isCompleteLinkDestination,
      );

      // Legacy: a route that held several named links becomes several
      // single-destination routes, one per link, each with its own trigger.
      if (complete.length > 1) {
        complete.forEach((dest, index) => {
          const kw =
            link.keywords?.trim() ||
            dest.label.trim() ||
            link.intent.trim() ||
            "";
          routes.push({
            id: `${baseId}_${slugifyRouteId(dest.label, index)}`,
            templateId,
            name:
              link.label.trim() ||
              dest.label.trim() ||
              template?.defaultName ||
              "Route",
            keywords: kw,
            outcome,
            active: true,
            url: dest.url.trim(),
            businessFileId: null,
            email: "",
            whatsapp: "",
            note: DEFAULT_INBOX_NOTE,
            description: link.description?.trim() || undefined,
          });
        });
        continue;
      }

      const only = complete[0] ?? null;
      const kw =
        link.keywords?.trim() ||
        link.intent.trim() ||
        only?.label.trim() ||
        link.label.trim() ||
        "";
      routes.push({
        id: baseId,
        templateId,
        name:
          link.label.trim() ||
          only?.label.trim() ||
          template?.defaultName ||
          "Route",
        keywords: kw,
        outcome,
        active: true,
        url: (only?.url ?? link.url).trim(),
        businessFileId: null,
        email: "",
        whatsapp: "",
        note: DEFAULT_INBOX_NOTE,
        description: link.description?.trim() || undefined,
      });
      continue;
    }

    const isBuiltinSpeak = link.presetId === SPEAK_TO_PERSON_TEMPLATE_ID;
    const kw =
      link.keywords?.trim() ||
      link.intent.trim() ||
      link.label.trim() ||
      "";
    routes.push({
      id: isBuiltinSpeak ? BUILTIN_SPEAK_TO_PERSON_ID : baseId,
      templateId,
      kind: isBuiltinSpeak ? "builtin" : isFallbackRoute({ templateId }) ? undefined : "custom",
      builtinId: isBuiltinSpeak ? "speak_to_person" : undefined,
      name: link.label.trim() || template?.defaultName || "Route",
      keywords: kw,
      outcome,
      active: true,
      url: "",
      businessFileId: link.businessFileId ?? null,
      email: outcome === "email" ? link.url.trim() : "",
      whatsapp: outcome === "whatsapp" ? link.url.trim() : "",
      note: outcome === "action_inbox" ? link.url.trim() || DEFAULT_INBOX_NOTE : DEFAULT_INBOX_NOTE,
      transferNumber: outcome === "transfer" ? link.url.trim() : undefined,
      transferLabel:
        outcome === "transfer" && link.transferLabel
          ? String(link.transferLabel).trim()
          : undefined,
      transferDuringHoursOnly:
        outcome === "transfer" ? link.transferDuringHoursOnly === true : undefined,
      description: link.description?.trim() || undefined,
    });
  }

  return routes;
}

function routeSetupMessage(route: SavedRoute): string {
  const name = route.name.trim() || "This route";
  switch (route.outcome) {
    case "send_link":
      return `“${name}” needs a link for Cara to text callers.`;
    case "send_file":
      return `“${name}” needs a file from Cara Setup.`;
    case "email":
      return `“${name}” needs an email address.`;
    case "whatsapp":
      return `“${name}” needs a WhatsApp number or link.`;
    case "transfer":
      return `“${name}” needs a transfer number in Settings.`;
    default:
      return `Finish setup for “${name}”.`;
  }
}

export function validateRoutes(
  routes: SavedRoute[],
  opts?: { transferNumber?: string },
): string | null {
  const seenNames = new Map<string, string>();
  for (const route of routes) {
    if (!route.active) continue;
    const name = route.name.trim();
    if (!name) {
      return "Give each route a name so you can find it in your list.";
    }
    if (!isFallbackRoute(route) && !isSpeakToPersonBuiltin(route) && !routeKeywords(route)) {
      return `“${name}” needs keywords — what callers might say out loud (e.g. “book an appointment”).`;
    }
    const key = name.toLowerCase();
    if (seenNames.has(key)) {
      return `Two routes are both called “${name}”. Give each a distinct name for your list.`;
    }
    seenNames.set(key, name);
    if (route.outcome === "send_link" && route.url.trim()) {
      const urlErr = validateRouteUrl(route.url);
      if (urlErr) return `“${name}”: ${urlErr}`;
    }
    if (
      route.outcome === "transfer" &&
      !isSpeakToPersonBuiltin(route) &&
      !route.transferNumber?.trim() &&
      !opts?.transferNumber?.trim()
    ) {
      return `“${name}” needs a transfer number.`;
    }
    if (routeNeedsSetup(route)) {
      return routeSetupMessage(route);
    }
  }
  return null;
}
