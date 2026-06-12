"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";

import { normalizeRoutingLink } from "./routing-owner-copy";
import { parseRoutingLinks, type RoutingLink } from "./routing-links";
import { validateRoutes, routesFromStoredLinks } from "./route-models";

type SaveResult = { ok: true } | { ok: false; message: string };

/**
 * Persist active routing capabilities (links, file, message, etc.).
 */
export async function saveRoutingLinks(links: RoutingLink[]): Promise<SaveResult> {
  const { supabase, organizationId } = await requireDashboardAdmin();

  if (!Array.isArray(links)) {
    return { ok: false, message: "Invalid routing payload." };
  }

  const parsed = parseRoutingLinks(links).map((l) => normalizeRoutingLink(l));
  const { data: org } = await supabase
    .from("organizations")
    .select("fallback_number")
    .eq("id", organizationId)
    .maybeSingle();
  const transferNumber = String(
    (org as { fallback_number?: string | null } | null)?.fallback_number ?? "",
  ).trim();
  const err = validateRoutes(routesFromStoredLinks(parsed), { transferNumber });
  if (err) return { ok: false, message: err };

  const { error } = await supabase
    .from("organizations")
    .update({
      routing_links: parsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };

  // Recompile Cara's call-handling prompt so the matching rules and fallback
  // reflect the routes that were just saved (otherwise the prompt goes stale).
  await regenerateCaraCustomPrompt(supabase, organizationId);

  revalidatePath("/dashboard/routing");
  revalidatePath("/dashboard/routing/routes");
  return { ok: true };
}
