export const ORGANIZATION_NICHES = ["hair_salon", "barber"] as const;

export type OrganizationNiche = (typeof ORGANIZATION_NICHES)[number];

/** Labels in admin pickers */
export const ORGANIZATION_NICHE_ADMIN_LABELS: Record<OrganizationNiche, string> =
  {
    hair_salon: "Hair Salon",
    barber: "Barber",
  };

/** Short product name beside “Cliste” in the salon dashboard header */
export const PRODUCT_NAME_BY_NICHE: Record<OrganizationNiche, string> = {
  hair_salon: "Salon",
  barber: "Barber",
};

export function isOrganizationNiche(v: string): v is OrganizationNiche {
  return ORGANIZATION_NICHES.includes(v as OrganizationNiche);
}

export function parseOrganizationNiche(
  raw: string | null | undefined,
): OrganizationNiche {
  if (raw && isOrganizationNiche(raw)) return raw;
  return "hair_salon";
}

export function productNameForNiche(
  raw: string | null | undefined,
): string {
  return PRODUCT_NAME_BY_NICHE[parseOrganizationNiche(raw)];
}
