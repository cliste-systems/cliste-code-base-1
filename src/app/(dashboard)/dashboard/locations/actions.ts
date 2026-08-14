"use server";

import { revalidatePath } from "next/cache";

import { canAddLocation } from "@/lib/account-locations";
import { loadAccountBilling, countAccountLocations } from "@/lib/account-session";
import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { syncAccountLocationAddonQuantity } from "@/lib/location-billing-sync";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import {
  departmentInsertsFromTemplate,
  organizationInsertFromStoreTemplate,
  STORE_TEMPLATE_ORG_COLUMNS,
  type StoreTemplatePrimary,
} from "@/lib/store-from-template";
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
    .select(STORE_TEMPLATE_ORG_COLUMNS.join(", "))
    .eq("account_id", session.accountId)
    .eq("is_primary_location", true)
    .maybeSingle();

  const slug = await uniqueLocationSlug(admin, slugifyLocationName(locationName));
  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .insert(
      organizationInsertFromStoreTemplate({
        accountId: session.accountId,
        locationName,
        slug,
        address,
        eircode,
        planTier,
        primary: (primary as StoreTemplatePrimary | null) ?? null,
      }),
    )
    .select("id")
    .single();

  if (orgErr || !orgRow?.id) {
    return { ok: false, message: orgErr?.message ?? "Could not create location." };
  }

  const organizationId = orgRow.id as string;

  const primaryId = (primary as StoreTemplatePrimary | null)?.id;
  if (primaryId) {
    const { data: deptRows, error: deptErr } = await admin
      .from("store_departments")
      .select(
        "name, uses_store_hours, hours, transfer_number, is_off_licence, is_an_post, sort_order",
      )
      .eq("organization_id", primaryId)
      .order("sort_order", { ascending: true });
    if (deptErr) {
      console.warn("[locations] department template copy skipped", deptErr.message);
    } else {
      const inserts = departmentInsertsFromTemplate(
        (deptRows ?? []) as Record<string, unknown>[],
        organizationId,
      );
      if (inserts.length > 0) {
        const { error: copyErr } = await admin
          .from("store_departments")
          .insert(inserts);
        if (copyErr) {
          console.warn("[locations] department template insert", copyErr.message);
        }
      }
    }
  }

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

  const prompt = await regenerateCaraCustomPrompt(admin, organizationId);
  if (!prompt.ok) {
    console.warn("[locations] prompt compile failed", prompt.message);
  }

  revalidatePath(DASHBOARD_ROUTES.locations);
  revalidatePath("/dashboard", "layout");
  return { ok: true, organizationId };
}
