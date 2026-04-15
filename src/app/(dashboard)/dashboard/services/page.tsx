import { redirect } from "next/navigation";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { isMissingStorefrontSchemaError } from "@/lib/organization-storefront-query";
import { parseStorefrontTeamMembers } from "@/lib/storefront-blocks";
import { servicesTableHasExtendedColumns } from "@/lib/services-schema";

import { ServicesView, type DashboardServiceRow } from "./services-view";

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

  const { data: svcRows, error: svcError } = await (extendedSchema
    ? supabase
        .from("services")
        .select(
          "id, name, category, price, duration_minutes, description, ai_voice_notes, is_published"
        )
        .eq("organization_id", organizationId)
        .order("name")
    : supabase
        .from("services")
        .select("id, name, category, price, duration_minutes")
        .eq("organization_id", organizationId)
        .order("name"));

  const initialTeamMembers = parseStorefrontTeamMembers(
    "storefront_team_members" in org
      ? (org as { storefront_team_members?: unknown }).storefront_team_members
      : undefined,
  );

  const initialServices: DashboardServiceRow[] =
    !svcError && svcRows
      ? svcRows.map((s) => ({
          id: s.id as string,
          name: (s.name as string) ?? "",
          category: (s.category as string) ?? "",
          priceEur: String(s.price ?? ""),
          durationMin: String(s.duration_minutes ?? ""),
          description: (s as { description?: string }).description ?? "",
          aiVoiceNotes: (s as { ai_voice_notes?: string }).ai_voice_notes ?? "",
          isPublished:
            (s as { is_published?: boolean }).is_published !== false,
        }))
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
          teamSyncKey={org.updated_at ?? ""}
        />
      )}
    </div>
  );
}
