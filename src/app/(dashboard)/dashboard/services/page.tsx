import { redirect } from "next/navigation";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { isMissingStorefrontSchemaError } from "@/lib/organization-storefront-query";
import { parseStorefrontTeamMembers } from "@/lib/storefront-blocks";
import { servicesTableHasExtendedColumns } from "@/lib/services-schema";

import { ServicesView, type DashboardServiceRow } from "./services-view";
import type { ServiceCategory } from "./categories-actions";

export default async function DashboardServicesPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const ORG_SELECT_WITH_TEAM =
    "slug, tier, updated_at, storefront_team_members";
  const ORG_SELECT_BASE = "slug, tier, updated_at";

  let orgRes = await supabase
    .from("organizations")
    .select(ORG_SELECT_WITH_TEAM)
    .eq("id", organizationId)
    .maybeSingle();

  if (
    orgRes.error &&
    isMissingStorefrontSchemaError(orgRes.error.message)
  ) {
    orgRes = await supabase
      .from("organizations")
      .select(ORG_SELECT_BASE)
      .eq("id", organizationId)
      .maybeSingle();
  }

  const { data: org, error: orgError } = orgRes;

  if (orgError || !org) {
    return (
      <div className="-mx-6 -mt-8 flex min-h-0 flex-1 flex-col bg-gray-50 px-6 py-8 lg:-mx-12 lg:px-12">
        <div className="rounded-2xl border border-red-200/80 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-red-700">
            Could not load organization
          </p>
          <p className="mt-2 text-sm text-gray-600">
            {orgError?.message ?? "No organization found."}
          </p>
        </div>
      </div>
    );
  }

  if (org.tier !== "native") {
    redirect("/dashboard");
  }

  const extendedSchema = await servicesTableHasExtendedColumns(supabase);

  const SERVICE_FIELDS_BASE =
    "id, name, category, price, duration_minutes, category_id, buffer_before_min, buffer_after_min, deposit_required, deposit_amount_cents, deposit_percent, processing_before_min, processing_min, processing_after_min";
  const SERVICE_FIELDS_EXTENDED = `${SERVICE_FIELDS_BASE}, description, ai_voice_notes, is_published`;

  const { data: svcRows, error: svcError } = await (extendedSchema
    ? supabase
        .from("services")
        .select(SERVICE_FIELDS_EXTENDED)
        .eq("organization_id", organizationId)
        .order("name")
    : supabase
        .from("services")
        .select(SERVICE_FIELDS_BASE)
        .eq("organization_id", organizationId)
        .order("name"));

  const { data: catRows, error: catError } = await supabase
    .from("service_categories")
    .select("id, name, display_order")
    .eq("organization_id", organizationId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  const initialCategories: ServiceCategory[] = catError
    ? []
    : (catRows ?? []).map((r) => ({
        id: r.id as string,
        name: (r.name as string) ?? "",
        displayOrder: (r.display_order as number) ?? 0,
      }));

  const initialTeamMembers = parseStorefrontTeamMembers(
    "storefront_team_members" in org
      ? (org as { storefront_team_members?: unknown }).storefront_team_members
      : undefined,
  );

  const initialServices: DashboardServiceRow[] =
    !svcError && svcRows
      ? svcRows.map((s) => {
          const r = s as Record<string, unknown>;
          return {
            id: r.id as string,
            name: (r.name as string) ?? "",
            category: (r.category as string) ?? "",
            priceEur: String(r.price ?? ""),
            durationMin: String(r.duration_minutes ?? ""),
            description: (r.description as string | undefined) ?? "",
            aiVoiceNotes: (r.ai_voice_notes as string | undefined) ?? "",
            isPublished: r.is_published !== false,
            categoryId: (r.category_id as string | null | undefined) ?? null,
            bufferBeforeMin: Number(r.buffer_before_min ?? 0) || 0,
            bufferAfterMin: Number(r.buffer_after_min ?? 0) || 0,
            depositRequired: Boolean(r.deposit_required),
            depositAmountCents:
              r.deposit_amount_cents == null
                ? null
                : Number(r.deposit_amount_cents) || 0,
            depositPercent:
              r.deposit_percent == null ? null : Number(r.deposit_percent) || 0,
            processingBeforeMin: Number(r.processing_before_min ?? 0) || 0,
            processingMin: Number(r.processing_min ?? 0) || 0,
            processingAfterMin: Number(r.processing_after_min ?? 0) || 0,
          };
        })
      : [];

  return (
    <div className="-mx-6 -mt-8 flex h-full min-h-0 flex-1 flex-col bg-gray-50 lg:-mx-12">
      {svcError ? (
        <div className="mx-auto max-w-2xl px-6 py-8 lg:px-12">
          <div className="rounded-2xl border border-red-200/80 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-red-700">
              Could not load services
            </p>
            <p className="mt-2 text-sm text-gray-600">{svcError.message}</p>
          </div>
        </div>
      ) : (
        <ServicesView
          key={`${org.updated_at ?? "0"}-${initialServices.map((s) => s.id).sort().join("|")}`}
          extendedSchema={extendedSchema}
          initialServices={initialServices}
          initialTeamMembers={initialTeamMembers}
          initialCategories={initialCategories}
          teamSyncKey={org.updated_at ?? ""}
        />
      )}
    </div>
  );
}
