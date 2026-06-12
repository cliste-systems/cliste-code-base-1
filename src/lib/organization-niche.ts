export const ORGANIZATION_NICHES = [
  "hair_salon",
  "barber",
  "beauty",
  "trades",
  "home_services",
  "hospitality",
  "retail",
  "ecommerce",
  "professional_services",
  "fitness",
  "automotive",
  "events",
  "education",
  "other",
] as const;

export type OrganizationNiche = (typeof ORGANIZATION_NICHES)[number];

/** Labels in admin pickers */
export const ORGANIZATION_NICHE_ADMIN_LABELS: Record<OrganizationNiche, string> =
  {
    hair_salon: "Hair Salon",
    barber: "Barber",
    beauty: "Beauty & Nails",
    trades: "Trades & Construction",
    home_services: "Home Services",
    hospitality: "Hospitality & Food",
    retail: "Retail & Shops",
    ecommerce: "E-commerce / Online",
    professional_services: "Professional Services",
    fitness: "Fitness & Wellness",
    automotive: "Automotive",
    events: "Events & Entertainment",
    education: "Education & Training",
    other: "Other",
  };

/** Short product name beside “Cliste” in the dashboard header */
export const PRODUCT_NAME_BY_NICHE: Record<OrganizationNiche, string> = {
  hair_salon: "Salon",
  barber: "Barber",
  beauty: "Beauty",
  trades: "Trades",
  home_services: "Home Services",
  hospitality: "Hospitality",
  retail: "Retail",
  ecommerce: "Online",
  professional_services: "Professional",
  fitness: "Fitness",
  automotive: "Automotive",
  events: "Events",
  education: "Education",
  other: "Business",
};

/**
 * Verticals that usually operate without a public physical address (so the
 * onboarding location fields are optional rather than expected).
 */
const ONLINE_FIRST_NICHES: ReadonlySet<OrganizationNiche> = new Set([
  "ecommerce",
]);

export function isOrganizationNiche(v: string): v is OrganizationNiche {
  return ORGANIZATION_NICHES.includes(v as OrganizationNiche);
}

export function parseOrganizationNiche(
  raw: string | null | undefined,
): OrganizationNiche {
  if (raw && isOrganizationNiche(raw)) return raw;
  return "other";
}

export function nicheAdminLabel(raw: string | null | undefined): string {
  return ORGANIZATION_NICHE_ADMIN_LABELS[parseOrganizationNiche(raw)];
}

/** Whether this vertical typically has a public physical location/address. */
export function nicheHasPhysicalLocation(
  raw: string | null | undefined,
): boolean {
  return !ONLINE_FIRST_NICHES.has(parseOrganizationNiche(raw));
}
