"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import type {
  RetailStoreAssortmentOverrideStatus,
  RetailStoreAssortmentStatus,
} from "@/lib/retail-store-assortment";
import { createAdminClient } from "@/utils/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function setProductAssortmentStatus(
  formData: FormData,
): Promise<void> {
  const session = await requireDashboardAdmin();
  const organizationId = session.organizationId;
  const userId = session.user.id;
  const productId = String(formData.get("product_id") ?? "").trim();
  const rawStatus = String(formData.get("status") ?? "").trim();

  if (!UUID_RE.test(productId)) {
    throw new Error("Invalid product.");
  }

  if (
    rawStatus !== "stocked" &&
    rawStatus !== "not_stocked" &&
    rawStatus !== "not_confirmed"
  ) {
    throw new Error("Invalid assortment status.");
  }

  const status = rawStatus as RetailStoreAssortmentStatus;
  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("niche, retail_banner")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgError) throw new Error(orgError.message);
  if (!org || String(org.niche ?? "") !== "retail") {
    throw new Error("Product assortment is only available for retail stores.");
  }

  const retailBanner = String(org.retail_banner ?? "").trim();
  if (!retailBanner) {
    throw new Error("This store does not have a retail catalogue configured.");
  }

  const { data: product, error: productError } = await admin
    .from("retail_catalog_products")
    .select("id")
    .eq("id", productId)
    .eq("retail_banner", retailBanner)
    .maybeSingle();

  if (productError) throw new Error(productError.message);
  if (!product) throw new Error("Product is not part of this retailer catalogue.");

  if (status === "not_confirmed") {
    const { error } = await admin
      .from("retail_store_product_assortment")
      .delete()
      .eq("organization_id", organizationId)
      .eq("product_id", productId);
    if (error) throw new Error(error.message);
  } else {
    const persistedStatus: RetailStoreAssortmentOverrideStatus = status;
    const now = new Date().toISOString();
    const { error } = await admin
      .from("retail_store_product_assortment")
      .upsert(
        {
          organization_id: organizationId,
          product_id: productId,
          status: persistedStatus,
          source: "dashboard",
          confirmed_at: now,
          updated_at: now,
          updated_by: userId,
        },
        { onConflict: "organization_id,product_id" },
      );
    if (error) throw new Error(error.message);
  }

  revalidatePath(DASHBOARD_ROUTES.products);
}
