"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { suggestRouteNaming } from "@/lib/route-naming-suggest";

import { normalizeRoutingLink } from "./routing-owner-copy";
import { parseRoutingLinks, type RoutingLink } from "./routing-links";
import { validateRoutes, routesFromStoredLinks } from "./route-models";
import type {
  RouteNameSuggestionInput,
  SuggestRouteNameResult,
} from "./route-templates";

type SaveResult = { ok: true } | { ok: false; message: string };

/**
 * Persist active routing capabilities (links, file, message, etc.).
 */
export async function saveRoutingLinks(links: RoutingLink[]): Promise<SaveResult> {
  const { supabase, organizationId } = await requireDashboardSession();

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

export async function loadRoutingLinks(): Promise<RoutingLink[]> {
  const { supabase, organizationId } = await requireDashboardSession();
  const { data } = await supabase
    .from("organizations")
    .select("routing_links")
    .eq("id", organizationId)
    .maybeSingle();
  return parseRoutingLinks((data as { routing_links?: unknown } | null)?.routing_links);
}

/** AI-suggest a clear, caller-facing name for one action (optional helper). */
export async function suggestRoutingActionName(
  input: RouteNameSuggestionInput,
): Promise<SuggestRouteNameResult> {
  const { supabase, organizationId } = await requireDashboardSession();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, agent_business_type, niche")
    .eq("id", organizationId)
    .maybeSingle();

  const suggestion = await suggestRouteNaming(
    {
      businessName: String(org?.name ?? "").trim(),
      businessType: String(org?.agent_business_type ?? "").trim(),
      niche: String(org?.niche ?? "").trim(),
    },
    input,
  );

  if (!suggestion) return { ok: false };
  return { ok: true, ...suggestion };
}
