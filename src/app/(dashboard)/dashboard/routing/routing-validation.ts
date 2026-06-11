import { detectCanonicalQuestion } from "@/lib/answers-boundary";
import { findNearDuplicateChip } from "@/lib/cara-setup-chips";

import { routeKeywords, type SavedRoute } from "./route-models";
import type { RoutingSetupContext } from "./routing-setup-context";

export type RouteLintWarning = {
  id: string;
  routeId: string;
  kind: "near_duplicate" | "canonical" | "services_conflict";
  message: string;
  href?: string;
  linkLabel?: string;
};

const URL_FORMAT =
  /^https?:\/\/[^\s/$.?#][^\s]*$/i;

export function isValidHttpUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (!URL_FORMAT.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateRouteUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "Add a link for Cara to text.";
  if (!isValidHttpUrl(trimmed)) {
    return "Enter a full web address starting with https:// (check for typos).";
  }
  return null;
}

function servicesConflictMessage(
  trigger: string,
  excluded: string,
): string {
  return `“${trigger}” may promise work you listed as not offered (“${excluded}”). Cara should take a message instead — or update Services in Setup.`;
}

export function findServicesConflict(
  trigger: string,
  servicesNotOffered: string[],
): string | null {
  const lower = trigger.trim().toLowerCase();
  if (!lower) return null;

  for (const item of servicesNotOffered) {
    const ex = item.trim().toLowerCase();
    if (!ex) continue;
    if (lower.includes(ex) || ex.includes(lower)) return item;
    const near = findNearDuplicateChip(trigger, [item]);
    if (near) return near;
  }
  return null;
}

export function buildRouteLintWarnings(
  route: SavedRoute,
  setup: Pick<RoutingSetupContext, "servicesNotOffered">,
  otherActiveNames: string[],
): RouteLintWarning[] {
  const warnings: RouteLintWarning[] = [];
  const keywords = routeKeywords(route);
  if (!keywords) return warnings;

  const nearDup = findNearDuplicateChip(keywords, otherActiveNames);
  if (nearDup) {
    warnings.push({
      id: `${route.id}-near-dup`,
      routeId: route.id,
      kind: "near_duplicate",
      message: `“${keywords}” is very close to “${nearDup}”. Route order decides the winner — make keywords distinct or drag the more specific one higher.`,
    });
  }

  const canonical = detectCanonicalQuestion(keywords);
  if (canonical) {
    warnings.push({
      id: `${route.id}-canonical`,
      routeId: route.id,
      kind: "canonical",
      message: `Cara answers this from Setup — routes are for sends, transfers, and logs, not FAQs.`,
      href: canonical.setupHref,
      linkLabel: `Edit in ${canonical.setupLabel}`,
    });
  }

  const excluded = findServicesConflict(keywords, setup.servicesNotOffered);
  if (excluded) {
    warnings.push({
      id: `${route.id}-services`,
      routeId: route.id,
      kind: "services_conflict",
      message: servicesConflictMessage(keywords, excluded),
      href: "/dashboard/cara-setup/services",
      linkLabel: "Edit services",
    });
  }

  return warnings;
}

export function buildAllRouteLintWarnings(
  routes: SavedRoute[],
  setup: Pick<RoutingSetupContext, "servicesNotOffered">,
): RouteLintWarning[] {
  const active = routes.filter((r) => r.active);
  const warnings: RouteLintWarning[] = [];

  for (const route of active) {
    const others = active
      .filter((r) => r.id !== route.id)
      .map((r) => routeKeywords(r))
      .filter(Boolean);
    warnings.push(...buildRouteLintWarnings(route, setup, others));
  }

  return warnings;
}
