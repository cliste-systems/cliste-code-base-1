/** Columns copied from the primary store when adding another location. */
export const STORE_TEMPLATE_ORG_COLUMNS = [
  "id",
  "niche",
  "agent_business_type",
  "plan_tier",
  "billing_interval",
  "tier",
  "call_routing_mode",
  "agent_voice_id",
  "greeting",
  "assistant_display_name",
  "agent_faqs",
  "agent_opening_hours",
  "business_hours",
  "agent_services_departments",
  "agent_services_not_offered",
  "agent_business_rules",
  "agent_cara_conduct",
  "quote_prices_on_calls",
] as const;

export type StoreTemplatePrimary = {
  id: string;
  niche: string | null;
  agent_business_type: string | null;
  plan_tier: string | null;
  billing_interval: string | null;
  tier: string | null;
  call_routing_mode: string | null;
  agent_voice_id: string | null;
  greeting: string | null;
  assistant_display_name: string | null;
  agent_faqs: unknown;
  agent_opening_hours: string | null;
  business_hours: unknown;
  agent_services_departments: string | null;
  agent_services_not_offered: string | null;
  agent_business_rules: unknown;
  agent_cara_conduct: unknown;
  quote_prices_on_calls: boolean | null;
};

export function organizationInsertFromStoreTemplate(input: {
  accountId: string;
  locationName: string;
  slug: string;
  address: string;
  eircode: string;
  planTier: string;
  primary: StoreTemplatePrimary | null;
}): Record<string, unknown> {
  const primary = input.primary;
  return {
    account_id: input.accountId,
    is_primary_location: false,
    name: input.locationName,
    slug: input.slug,
    address: input.address || null,
    agent_location_address: input.address || null,
    agent_location_eircode: input.eircode || null,
    storefront_eircode: input.eircode || null,
    tier: primary?.tier ?? "native",
    niche: primary?.niche ?? "retail",
    agent_business_type: primary?.agent_business_type ?? null,
    plan_tier: primary?.plan_tier ?? input.planTier,
    billing_interval: primary?.billing_interval ?? "month",
    call_routing_mode: primary?.call_routing_mode ?? "cara",
    agent_voice_id: primary?.agent_voice_id ?? null,
    greeting: primary?.greeting ?? null,
    assistant_display_name: primary?.assistant_display_name ?? null,
    agent_faqs: primary?.agent_faqs ?? null,
    agent_opening_hours: primary?.agent_opening_hours ?? null,
    business_hours: primary?.business_hours ?? null,
    agent_services_departments: primary?.agent_services_departments ?? null,
    agent_services_not_offered: primary?.agent_services_not_offered ?? null,
    agent_business_rules: primary?.agent_business_rules ?? null,
    agent_cara_conduct: primary?.agent_cara_conduct ?? null,
    quote_prices_on_calls: primary?.quote_prices_on_calls ?? false,
    status: "active",
    is_active: true,
    onboarding_step: 8,
    launch_status: "completed",
  };
}

export function departmentInsertsFromTemplate(
  rows: Array<Record<string, unknown>>,
  organizationId: string,
): Record<string, unknown>[] {
  return rows.map((row, i) => ({
    organization_id: organizationId,
    name: String(row.name ?? "").trim(),
    uses_store_hours: row.uses_store_hours !== false,
    hours: row.hours ?? null,
    transfer_number: row.transfer_number ?? null,
    is_off_licence: row.is_off_licence === true,
    is_an_post: row.is_an_post === true,
    sort_order:
      typeof row.sort_order === "number" && Number.isFinite(row.sort_order)
        ? row.sort_order
        : i,
  })).filter((row) => String(row.name).trim().length > 0);
}
