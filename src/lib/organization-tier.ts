/** Native-only product for now; replace with `organizations.tier` from Supabase when needed. */
export const MOCK_ORGANIZATION_TIER = "native" as const;
export type OrganizationTier = typeof MOCK_ORGANIZATION_TIER;
