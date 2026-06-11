"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isFallbackRoute,
  routesFromStoredLinks,
  serializeRoutes,
  validateRoutes,
  type SavedRoute,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import { normalizeRoutingLink } from "@/app/(dashboard)/dashboard/routing/routing-owner-copy";
import type {
  RouteNameSuggestionInput,
  SuggestRouteNameResult,
} from "@/app/(dashboard)/dashboard/routing/route-templates";
import {
  CARA_BASELINE_HANDLE_OPTIONS,
  type CaraHandleOptionId,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-constants";
import {
  ONBOARDING_STEPS,
  requireOnboardingSession,
} from "@/lib/onboarding-session";
import { suggestRouteNaming } from "@/lib/route-naming-suggest";
import { createAdminClient } from "@/utils/supabase/admin";

export type SaveOnboardingActionsResult =
  | { ok: true }
  | { ok: false; message: string };

/** Map saved routes to the handle-option ids the dashboard/agent copy reads. */
function deriveHandleOptions(routes: SavedRoute[]): CaraHandleOptionId[] {
  const ids = new Set<CaraHandleOptionId>(CARA_BASELINE_HANDLE_OPTIONS);
  for (const route of routes) {
    if (!route.active || isFallbackRoute(route)) continue;
    switch (route.outcome) {
      case "send_link":
        ids.add("send_link");
        break;
      case "send_file":
        ids.add("send_file");
        break;
      case "email":
        ids.add("email_request");
        break;
      case "whatsapp":
        ids.add("send_whatsapp");
        break;
      case "action_inbox":
        ids.add("capture_quote_requests");
        break;
    }
  }
  return [...ids];
}

async function advanceToNumberStep(organizationId: string): Promise<never> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      onboarding_step: ONBOARDING_STEPS.number,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) throw new Error(error.message);

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/number");
}

export async function saveOnboardingActions(
  routes: SavedRoute[],
): Promise<SaveOnboardingActionsResult | never> {
  const session = await requireOnboardingSession();

  const routeError = validateRoutes(routes);
  if (routeError) return { ok: false, message: routeError };

  const links = parseRoutingLinks(serializeRoutes(routes)).map((link) =>
    normalizeRoutingLink(link),
  );
  const handleOptions = deriveHandleOptions(routesFromStoredLinks(links));

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      routing_links: links,
      cara_handle_options: handleOptions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/onboarding/actions");
  revalidatePath("/dashboard/routing");
  return advanceToNumberStep(session.organizationId);
}

/** Skip configuring routes — Cara still answers and takes messages (baseline). */
export async function skipOnboardingActions(): Promise<never> {
  const session = await requireOnboardingSession();
  return advanceToNumberStep(session.organizationId);
}

/** AI-suggest a clear, caller-facing name for one action (optional helper). */
export async function suggestOnboardingActionName(
  input: RouteNameSuggestionInput,
): Promise<SuggestRouteNameResult> {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name, agent_business_type, niche")
    .eq("id", session.organizationId)
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
