import {
  nicheAdminLabel,
  parseOrganizationNiche,
} from "@/lib/organization-niche";
import {
  VERTICAL_PACKS,
  verticalIdForNiche,
} from "@/lib/verticals";

/**
 * Owner-facing label for the business type chosen at signup (vertical picker +
 * business description). Read-only in Settings.
 */
export function signupSegmentLabel(params: {
  niche?: string | null;
  businessType?: string | null;
}): string {
  const niche = parseOrganizationNiche(params.niche);
  const verticalId = verticalIdForNiche(niche);

  if (verticalId === "salon_beauty") {
    return VERTICAL_PACKS.salon_beauty.selection.label;
  }

  const businessType = params.businessType?.trim();
  if (businessType) return businessType;

  if (niche !== "other") {
    return nicheAdminLabel(niche);
  }

  return VERTICAL_PACKS.generic.selection.label;
}
