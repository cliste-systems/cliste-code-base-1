/** Fixed retail department slugs — same pack for every SuperValu store (v1). */
export const RETAIL_DEPARTMENT_SLUGS = [
  "management",
  "meat-counter",
  "fish-counter",
  "deli",
  "bakery",
  "fruit-veg",
  "off-licence",
  "click-collect",
  "back-office",
  "general",
] as const;

export type RetailDepartmentSlug = (typeof RETAIL_DEPARTMENT_SLUGS)[number];

export type RetailDepartmentDefinition = {
  slug: RetailDepartmentSlug;
  label: string;
  /** Sidebar / overview short label */
  shortLabel: string;
  keywords: RegExp;
  /** Static retail route ids from routing_links */
  routeIds?: string[];
  /** store_departments.name values mapped to this slug */
  storeDepartmentNames?: string[];
};

export const RETAIL_DEPARTMENTS: RetailDepartmentDefinition[] = [
  {
    slug: "management",
    label: "Management",
    shortLabel: "Management",
    keywords:
      /management|manager callback|manager on duty|store manager|complaint|unhappy|refund|disappointed|customer service|shop floor|general enquiry|general inquiry|till|checkout|speak to the manager|out of date|expired|food safety/i,
    routeIds: ["retail-complaint", "retail-lost-property"],
    storeDepartmentNames: ["Customer service", "Management"],
  },
  {
    slug: "meat-counter",
    label: "Meat counter",
    shortLabel: "Meat counter",
    keywords:
      /meat counter|butcher|butchers|steak|striploin|sirloin|rashers|sausage|meatball|lamb chop|pork chop|quick fry steak/i,
    storeDepartmentNames: ["Butcher", "Meat counter"],
  },
  {
    slug: "fish-counter",
    label: "Fish counter",
    shortLabel: "Fish counter",
    keywords:
      /fish counter|fishmonger|salmon|cod|haddock|prawn|seafood|trout|mackerel|tuna|goujon/i,
    storeDepartmentNames: ["Fish counter"],
  },
  {
    slug: "deli",
    label: "Deli",
    shortLabel: "Deli",
    keywords:
      /deli|corned beef|sliced ham|crumbed ham|cooked ham|charcuterie|salami|luncheon|carrolls|hot food/i,
    storeDepartmentNames: ["Deli / hot food", "Deli"],
  },
  {
    slug: "bakery",
    label: "Bakery",
    shortLabel: "Bakery",
    keywords: /bakery|birthday cake|celebration cake|cupcake|scone|baguette|bread order/i,
    routeIds: ["retail-bakery-cake"],
    storeDepartmentNames: ["Bakery"],
  },
  {
    slug: "fruit-veg",
    label: "Fruit & vegetables",
    shortLabel: "Fruit & veg",
    keywords:
      /fruit|vegetable|veg counter|produce|potato|apple|banana|tomato|mushroom|salad/i,
  },
  {
    slug: "off-licence",
    label: "Off-licence",
    shortLabel: "Off-licence",
    keywords:
      /off[- ]licence|wine|beer|lager|spirits|cider|whiskey|vodka|gin\b|prosecco|champagne/i,
    storeDepartmentNames: ["Off-licence"],
  },
  {
    slug: "click-collect",
    label: "Click & Collect",
    shortLabel: "Click & Collect",
    keywords: /click.?collect|collection order|online order pickup/i,
    storeDepartmentNames: ["Click & Collect"],
  },
  {
    slug: "back-office",
    label: "Back office",
    shortLabel: "Back office",
    keywords: /back office|accounts|hr\b|payroll|supplier/i,
    storeDepartmentNames: ["Back office"],
  },
  {
    slug: "general",
    label: "General",
    shortLabel: "General",
    keywords: /^$/,
  },
];

const DEPARTMENT_BY_SLUG = new Map(
  RETAIL_DEPARTMENTS.map((dept) => [dept.slug, dept]),
);

export function isRetailDepartmentSlug(value: string): value is RetailDepartmentSlug {
  return (RETAIL_DEPARTMENT_SLUGS as readonly string[]).includes(value);
}

export function retailDepartmentBySlug(
  slug: string | null | undefined,
): RetailDepartmentDefinition {
  const key = String(slug ?? "").trim();
  if (isRetailDepartmentSlug(key)) {
    return DEPARTMENT_BY_SLUG.get(key)!;
  }
  return DEPARTMENT_BY_SLUG.get("general")!;
}

export function retailDepartmentLabel(slug: string | null | undefined): string {
  return retailDepartmentBySlug(slug).label;
}

export function retailDepartmentPath(slug: string | null | undefined): string {
  const resolved = retailDepartmentBySlug(slug).slug;
  return `/dashboard/departments/${resolved}`;
}

/** Departments shown in sidebar (exclude general — use overview for unassigned). */
export function retailDepartmentNavItems(): RetailDepartmentDefinition[] {
  return RETAIL_DEPARTMENTS.filter((dept) => dept.slug !== "general");
}

/** Workspace route slug — unassigned tickets land in Management, not a 404. */
export function departmentWorkspaceSlug(
  slug: RetailDepartmentSlug,
): Exclude<RetailDepartmentSlug, "general"> {
  return slug === "general" ? "management" : slug;
}

const ROUTE_ID_TO_SLUG = new Map<string, RetailDepartmentSlug>();
for (const dept of RETAIL_DEPARTMENTS) {
  for (const routeId of dept.routeIds ?? []) {
    ROUTE_ID_TO_SLUG.set(routeId.toLowerCase(), dept.slug);
  }
}

const STORE_NAME_TO_SLUG = new Map<string, RetailDepartmentSlug>();
for (const dept of RETAIL_DEPARTMENTS) {
  for (const name of dept.storeDepartmentNames ?? []) {
    STORE_NAME_TO_SLUG.set(name.trim().toLowerCase(), dept.slug);
  }
}

export function mapRouteIdToDepartmentSlug(routeId: string | null | undefined): RetailDepartmentSlug | null {
  const key = String(routeId ?? "").trim().toLowerCase();
  if (!key) return null;
  const direct = ROUTE_ID_TO_SLUG.get(key);
  if (direct) return direct;
  if (key.startsWith("dept-")) return null;
  return null;
}

export function mapStoreDepartmentNameToSlug(
  name: string | null | undefined,
): RetailDepartmentSlug | null {
  const key = String(name ?? "").trim().toLowerCase();
  if (!key) return null;
  return STORE_NAME_TO_SLUG.get(key) ?? null;
}

export const ROUTE_SUFFIX_RE = /\s*\[route:\s*([^\]]+)\]\s*$/i;

export function parseRouteIdFromSummary(summary: string): string | null {
  const match = String(summary ?? "").match(ROUTE_SUFFIX_RE);
  return match?.[1]?.trim() ?? null;
}

export function stripRouteSuffixFromSummary(summary: string): string {
  return String(summary ?? "")
    .replace(ROUTE_SUFFIX_RE, "")
    .trim();
}
