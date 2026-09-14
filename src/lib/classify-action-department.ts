import {
  mapRouteIdToDepartmentSlug,
  mapStoreDepartmentNameToSlug,
  parseRouteIdFromSummary,
  type RetailDepartmentSlug,
  RETAIL_DEPARTMENTS,
  stripRouteSuffixFromSummary,
} from "@/lib/retail-department-pack";
import { stripDemoRehearsalMarker } from "@/lib/dashboard-mock-cleanup";

export type ClassifyActionDepartmentInput = {
  summary: string;
  departmentSlug?: string | null;
  routeId?: string | null;
  storeDepartmentName?: string | null;
};

export function classifyActionDepartment(
  input: ClassifyActionDepartmentInput,
): RetailDepartmentSlug {
  const explicit = String(input.departmentSlug ?? "").trim();
  if (explicit && explicit !== "general") {
    const fromPack = RETAIL_DEPARTMENTS.find((dept) => dept.slug === explicit);
    if (fromPack) return fromPack.slug;
  }

  const routeFromSummary = parseRouteIdFromSummary(input.summary);
  const routeId = String(input.routeId ?? routeFromSummary ?? "").trim();
  if (routeId) {
    const fromRoute = mapRouteIdToDepartmentSlug(routeId);
    if (fromRoute) return fromRoute;
  }

  const storeName = String(input.storeDepartmentName ?? "").trim();
  if (storeName) {
    const fromStore = mapStoreDepartmentNameToSlug(storeName);
    if (fromStore) return fromStore;
  }

  const text = stripRouteSuffixFromSummary(input.summary).toLowerCase();
  if (!text) return "general";

  for (const dept of RETAIL_DEPARTMENTS) {
    if (dept.slug === "general") continue;
    if (dept.keywords.test(text)) return dept.slug;
  }

  return "general";
}

/** Owner SMS is for urgent manager complaints only — not bakery/butcher dashboard tickets. */
export function shouldNotifyOwnerBySms(input: ClassifyActionDepartmentInput): boolean {
  return classifyActionDepartment(input) === "management";
}

/** One-line preview for triage lists. */
export function actionTicketBriefSummary(summary: string, maxLen = 120): string {
  const cleaned = stripDemoRehearsalMarker(stripRouteSuffixFromSummary(summary));
  if (!cleaned) return "Follow-up needed";
  const firstLine = cleaned.split(/\n/)[0]?.trim() ?? cleaned;
  const sentence = firstLine.split(/(?<=[.!?])\s+/)[0]?.trim() ?? firstLine;
  const preview = sentence || firstLine;
  if (preview.length <= maxLen) return preview;
  return `${preview.slice(0, maxLen).trimEnd()}…`;
}
