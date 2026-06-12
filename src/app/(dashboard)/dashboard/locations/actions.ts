"use server";

import { revalidatePath } from "next/cache";

import { canAddLocation } from "@/lib/account-locations";
import { loadAccountBilling, countAccountLocations } from "@/lib/account-session";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { syncAccountLocationAddonQuantity } from "@/lib/location-billing-sync";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import { createAdminClient } from "@/utils/supabase/admin";

export type LocationActionResult =
  | { ok: true; organizationId: string }
  | { ok: false; message: string };

function slugifyLocationName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function uniqueLocationSlug(
  admin: ReturnType<typeof createAdminClient>,
  base: string,
): Promise<string> {
  const seed = base || "location";
  let candidate = seed;
  for (let i = 0; i < 25; i++) {
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${seed.slice(0, 44)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${seed}-${Date.now().toString(36)}`;
}

export async function addAccountLocation(
  _prev: LocationActionResult | undefined,
  formData: FormData,
): Promise<LocationActionResult> {
  const session = await requireDashboardAdmin();
  const locationName = String(formData.get("locationName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const eircode = String(formData.get("eircode") ?? "").trim();

  if (locationName.length < 2 || locationName.length > 120) {
    return { ok: false, message: "Enter a location name (2–120 characters)." };
  }

  const billing = await loadAccountBilling(session.accountId);
  const locationCount = await countAccountLocations(session.accountId);
  const planTier = billing?.planTier ?? "pro";
  if (!canAddLocation(planTier, locationCount)) {
    return {
      ok: false,
      message:
        "Your plan includes one location. Upgrade to Business to add more sites.",
    };
  }

  const admin = createAdminClient();
  const { data: primary } = await admin
    .from("organizations")
    .select(
      "niche, agent_business_type, plan_tier, billing_interval, tier, call_routing_mode, agent_voice_id, greeting",
    )
    .eq("account_id", session.accountId)
    .eq("is_primary_location", true)
    .maybeSingle();

  const slug = await uniqueLocationSlug(admin, slugifyLocationName(locationName));
  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .insert({
      account_id: session.accountId,
      is_primary_location: false,
      name: locationName,
      slug,
      address: address || null,
      agent_location_address: address || null,
      agent_location_eircode: eircode || null,
      storefront_eircode: eircode || null,
      tier: (primary?.tier as string | null) ?? "native",
      niche: (primary?.niche as string | null) ?? "other",
      agent_business_type: (primary?.agent_business_type as string | null) ?? null,
      plan_tier: (primary?.plan_tier as string | null) ?? planTier,
      billing_interval: (primary?.billing_interval as string | null) ?? "month",
      call_routing_mode: (primary?.call_routing_mode as string | null) ?? "cara",
      agent_voice_id: (primary?.agent_voice_id as string | null) ?? null,
      greeting: (primary?.greeting as string | null) ?? null,
      status: "active",
      is_active: true,
      onboarding_step: 8,
      launch_status: "completed",
    })
    .select("id")
    .single();

  if (orgErr || !orgRow?.id) {
    return { ok: false, message: orgErr?.message ?? "Could not create location." };
  }

  const organizationId = orgRow.id as string;
  const phoneResult = await provisionOrganizationPhoneNumber(organizationId);
  if (!phoneResult.ok) {
    await admin.from("organizations").delete().eq("id", organizationId);
    return {
      ok: false,
      message: phoneResult.message ?? "Could not provision a phone number for this location.",
    };
  }

  const addonSync = await syncAccountLocationAddonQuantity(session.accountId);
  if (!addonSync.ok) {
    console.warn("[locations] addon sync failed", addonSync.message);
  }

  revalidatePath(DASHBOARD_ROUTES.locations);
  revalidatePath("/dashboard", "layout");
  return { ok: true, organizationId };
}
