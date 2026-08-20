import type { RoutingLink } from "@/app/(dashboard)/dashboard/routing/routing-links";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";
import { buildRetailRoutePack } from "@/lib/retail-route-pack";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function departmentKeywords(name: string): string {
  const base = name.toLowerCase();
  return `${base}, speak to ${base}, ${base} counter, ${base} department`;
}

export function buildDepartmentTransferRoutes(
  departments: StoreDepartmentRow[],
): RoutingLink[] {
  return departments
    .filter((d) => d.active && d.transfer_enabled)
    .map((d) => ({
      id: `dept-${d.id}`,
      presetId: "transfer",
      label: d.name,
      intent: d.name.toLowerCase(),
      targetType: "phone" as const,
      url: d.phone_e164?.trim() || "",
      transferLabel: d.name,
      transferDuringHoursOnly: d.hours != null,
      keywords: departmentKeywords(d.name),
      description: d.cara_note?.trim() || undefined,
      active: true,
    }));
}

const RETAIL_STATIC_PREFIXES = new Set([
  "retail-",
  "route_fallback",
]);

const DEPT_PREFIX = "dept-";

export function mergeRetailRoutingLinks(input: {
  departments: StoreDepartmentRow[];
  existingLinks: unknown;
  clickCollectUrl?: string;
  mapsUrl?: string;
}): RoutingLink[] {
  const existing = parseRoutingLinks(input.existingLinks ?? null);
  const preserved = existing.filter((link) => {
    if (link.id.startsWith(DEPT_PREFIX)) return false;
    if (RETAIL_STATIC_PREFIXES.has(link.id)) return false;
    if (link.presetId === "transfer" && link.id.startsWith(DEPT_PREFIX)) return false;
    return true;
  });

  const staticPack = buildRetailRoutePack({
    clickCollectUrl: input.clickCollectUrl,
    mapsUrl: input.mapsUrl,
  });

  const departmentRoutes = buildDepartmentTransferRoutes(input.departments);

  const byId = new Map<string, RoutingLink>();
  for (const link of [...staticPack, ...departmentRoutes, ...preserved]) {
    byId.set(link.id, link);
  }

  return Array.from(byId.values());
}

export function syncDepartmentRoutesPayload(input: {
  departments: StoreDepartmentRow[];
  existingLinks: unknown;
  clickCollectUrl?: string;
}): RoutingLink[] {
  return mergeRetailRoutingLinks(input);
}
