import { NextResponse } from "next/server";

import { syncSupervaluFullCatalog } from "@/lib/supervalu-catalog-sync";
import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function authorize(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-cron-secret");
  const candidate = bearer ?? header ?? "";
  return Boolean(candidate) && timingSafeEqualUtf8(candidate, secret);
}

export async function runSupervaluCatalogSyncCron(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("retail_source_store_id")
    .eq("niche", "retail")
    .eq("retail_banner", "supervalu")
    .eq("is_active", true);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const storeIds = [...new Set((orgs ?? []).map((r) => String(r.retail_source_store_id ?? "").trim()).filter(Boolean))];
  if (storeIds.length === 0) storeIds.push(process.env.SUPERVALU_STOREFRONT_STORE_ID?.trim() || "5550");

  const results = [];
  for (const storeId of storeIds) {
    results.push({ storeId, ...(await syncSupervaluFullCatalog(admin, { storeId })) });
  }
  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 502 });
}

export const GET = runSupervaluCatalogSyncCron;
export const POST = runSupervaluCatalogSyncCron;
