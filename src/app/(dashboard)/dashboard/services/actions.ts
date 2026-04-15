"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { isMissingStorefrontSchemaError } from "@/lib/organization-storefront-query";
import type { StorefrontTeamMember } from "@/lib/storefront-blocks";
import { parseStorefrontTeamMembers } from "@/lib/storefront-blocks";
import { uploadSalonImageFromDataUrl } from "@/lib/salon-image-upload";
import { syncOrganizationServices } from "@/lib/sync-organization-services";
import type { OrganizationServiceSyncInput } from "@/lib/sync-organization-services";

async function resolveTeamMemberImageUrls(
  organizationId: string,
  members: StorefrontTeamMember[],
): Promise<StorefrontTeamMember[]> {
  const out: StorefrontTeamMember[] = [];
  for (const m of members) {
    const name = m.name?.trim() ?? "";
    if (!name) continue;
    const raw =
      typeof m.imageUrl === "string" ? m.imageUrl.trim() : "";
    if (!raw) {
      out.push({ name });
      continue;
    }
    if (raw.startsWith("data:")) {
      const url = await uploadSalonImageFromDataUrl(
        organizationId,
        raw,
        "team",
      );
      out.push({ name, imageUrl: url });
    } else if (/^https?:\/\//i.test(raw)) {
      out.push({ name, imageUrl: raw });
    } else {
      out.push({ name });
    }
  }
  return out;
}

export async function saveDashboardServices(
  services: OrganizationServiceSyncInput[],
  options?: { teamMembers?: StorefrontTeamMember[] },
): Promise<
  | { ok: true; warning?: string }
  | { ok: false; message: string }
> {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: tierRow, error: tierError } = await supabase
    .from("organizations")
    .select("tier")
    .eq("id", organizationId)
    .single();

  if (tierError || !tierRow) {
    return {
      ok: false,
      message: tierError?.message ?? "Could not load organization.",
    };
  }

  if (tierRow.tier !== "native") {
    return {
      ok: false,
      message: "Service catalog is only available on the native booking plan.",
    };
  }

  const result = await syncOrganizationServices(
    supabase,
    organizationId,
    services
  );
  if (!result.ok) return result;

  if (options?.teamMembers !== undefined) {
    let forDb: StorefrontTeamMember[];
    try {
      forDb = await resolveTeamMemberImageUrls(
        organizationId,
        options.teamMembers,
      );
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error ? e.message : "Could not save team photos.",
      };
    }
    const normalized = parseStorefrontTeamMembers(forDb as unknown);
    const { error: teamError } = await supabase
      .from("organizations")
      .update({
        storefront_team_members: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);

    if (
      teamError &&
      !isMissingStorefrontSchemaError(teamError.message)
    ) {
      return { ok: false, message: teamError.message };
    }
  }

  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/storefront");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");

  const { data: slugRow } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", organizationId)
    .maybeSingle();
  if (slugRow?.slug) {
    revalidatePath(`/${slugRow.slug}`);
  }

  return { ok: true, ...(result.warning ? { warning: result.warning } : {}) };
}
