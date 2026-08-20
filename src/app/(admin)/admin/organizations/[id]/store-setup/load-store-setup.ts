import { parseCallRoutingMode } from "@/lib/call-routing";
import {
  defaultBankHolidayConfig,
  emptyWeekSchedule,
  isBusinessHoursUnset,
  parseBusinessHoursBundle,
} from "@/lib/business-hours";
import type { AdminStoreSetupData } from "@/lib/retail-store-types";
import {
  DIVERT_CARRIERS,
  RETAIL_BANNERS,
  type DivertCarrier,
  type RetailBanner,
} from "@/lib/retail-store-types";
import { createAdminClient } from "@/utils/supabase/admin";

function parseRetailBanner(raw: unknown): RetailBanner | "" {
  const s = String(raw ?? "").trim();
  return (RETAIL_BANNERS as readonly string[]).includes(s)
    ? (s as RetailBanner)
    : "";
}

function parseDivertCarrier(raw: unknown): DivertCarrier | "" {
  const s = String(raw ?? "").trim();
  return (DIVERT_CARRIERS as readonly string[]).includes(s)
    ? (s as DivertCarrier)
    : "";
}

export async function loadAdminStoreSetup(
  organizationId: string,
): Promise<AdminStoreSetupData | null> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data: org, error } = await admin
    .from("organizations")
    .select(
      "id, name, slug, niche, account_id, store_code, retail_banner, store_public_number, divert_carrier, divert_verified_at, agent_location_address, agent_location_eircode, agent_location_county, timezone, phone_number, call_routing_mode, fallback_number, retail_facilities, retail_delivery, retail_click_collect_url, retail_loyalty_program, quote_prices_on_calls, greeting, custom_prompt, prompt_compile_warnings, assistant_display_name, agent_voice_id, is_active, cara_online_since, business_hours, agent_opening_hours, routing_links",
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !org) return null;

  const [{ data: departments }, { data: contacts }] = await Promise.all([
    admin
      .from("store_departments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true }),
    admin
      .from("store_contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true }),
  ]);

  const warningsRaw = org.prompt_compile_warnings;
  const promptCompileWarnings = Array.isArray(warningsRaw)
    ? warningsRaw.map(String)
    : warningsRaw && typeof warningsRaw === "object"
      ? [JSON.stringify(warningsRaw)]
      : [];

  const deliveryRaw = org.retail_delivery;
  const retailDelivery =
    deliveryRaw && typeof deliveryRaw === "object" && !Array.isArray(deliveryRaw)
      ? (deliveryRaw as AdminStoreSetupData["retailDelivery"])
      : {};

  return {
    organizationId: org.id,
    name: String(org.name ?? ""),
    slug: String(org.slug ?? ""),
    niche: String(org.niche ?? ""),
    accountId: (org.account_id as string | null) ?? null,
    storeCode: String(org.store_code ?? ""),
    retailBanner: parseRetailBanner(org.retail_banner),
    agentLocationAddress: String(org.agent_location_address ?? ""),
    agentLocationEircode: String(org.agent_location_eircode ?? ""),
    agentLocationCounty: String(org.agent_location_county ?? ""),
    timezone: String(org.timezone ?? "Europe/Dublin"),
    phoneNumber: String(org.phone_number ?? ""),
    storePublicNumber: String(org.store_public_number ?? ""),
    callRoutingMode: parseCallRoutingMode(org.call_routing_mode),
    fallbackNumber: String(org.fallback_number ?? ""),
    divertCarrier: parseDivertCarrier(org.divert_carrier),
    divertVerifiedAt: (org.divert_verified_at as string | null) ?? null,
    retailFacilities: Array.isArray(org.retail_facilities)
      ? org.retail_facilities.map(String)
      : [],
    retailDelivery,
    retailClickCollectUrl: String(org.retail_click_collect_url ?? ""),
    retailLoyaltyProgram: String(org.retail_loyalty_program ?? ""),
    quotePricesOnCalls: org.quote_prices_on_calls === true,
    greeting: String(org.greeting ?? ""),
    customPrompt: String(org.custom_prompt ?? ""),
    promptCompileWarnings,
    assistantDisplayName: String(org.assistant_display_name ?? "Cara"),
    agentVoiceId: String(org.agent_voice_id ?? ""),
    isActive: org.is_active !== false,
    caraOnlineSince: (org.cara_online_since as string | null) ?? null,
    businessHours: (org.business_hours as Record<string, unknown> | null) ?? null,
    agentOpeningHours: String(org.agent_opening_hours ?? ""),
    routingLinks: org.routing_links,
    departments: (departments ?? []) as AdminStoreSetupData["departments"],
    contacts: (contacts ?? []) as AdminStoreSetupData["contacts"],
  };
}

export function parseStoreBusinessHours(data: AdminStoreSetupData) {
  if (isBusinessHoursUnset(data.businessHours)) {
    return {
      schedule: emptyWeekSchedule(),
      open24_7: false,
      bankHolidays: defaultBankHolidayConfig(),
      hoursNeverConfigured: true,
    };
  }
  const { schedule, meta } = parseBusinessHoursBundle(data.businessHours);
  return {
    schedule,
    open24_7: meta.open24_7 === true,
    bankHolidays: meta.bankHolidays ?? defaultBankHolidayConfig(),
    hoursNeverConfigured: false,
  };
}
