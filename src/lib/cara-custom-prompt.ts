import "server-only";

import { compileCaraPrompt } from "@/lib/compile-cara-prompt";

/** One saved call-flow action: when a caller asks about `trigger`, Cara does `action`. */
export type RoutingActionSummary = {
  /** What callers say out loud — phrases Cara matches against. */
  trigger: string;
  /** What Cara should do, e.g. "text them the saved link". */
  action: string;
  /** Owner instructions for when to use this route. */
  instruction?: string;
};

export type CaraCustomPromptInput = {
  businessName: string;
  businessType: string;
  knowledgeSummary: string;
  openingHours?: string;
  serviceArea?: string;
  servicesOffered?: string;
  servicesNotOffered?: string;
  detailsToCollect?: string;
  businessRules?: string[];
  faqs?: { question: string; answer: string }[];
  /** Saved call-flow routes (trigger -> action). Preferred over `routingActions`. */
  routes?: RoutingActionSummary[];
  /** What to do when nothing in `routes` matches (the "Anything else" fallback). */
  fallbackNote?: string;
  /** Legacy plain list of what Cara can do; used only when `routes` is absent. */
  routingActions?: string[];
  transferNumber?: string;
};

/**
 * Generate Cara's call-handling instructions (organizations.custom_prompt).
 * Delegates to {@link compileCaraPrompt} — structured fields are the single
 * source of truth (no AI rewrite).
 */
export async function generateCaraCustomPrompt(
  input: CaraCustomPromptInput,
): Promise<string> {
  return compileCaraPrompt({
    businessName: input.businessName,
    assistantDisplayName: "Cara",
    businessType: input.businessType,
    openingHours: input.openingHours,
    serviceArea: input.serviceArea,
    servicesOffered: input.servicesOffered,
    servicesNotOffered: input.servicesNotOffered,
    detailsToCollect: input.detailsToCollect,
    businessRules: input.businessRules,
    faqs: input.faqs,
    anythingElse: input.knowledgeSummary,
    routes: input.routes,
    fallbackNote: input.fallbackNote,
    transferNumber: input.transferNumber,
  });
}
