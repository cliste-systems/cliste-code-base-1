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

const DEFAULT_FALLBACK_NOTE =
  "take a message with their name, phone number, and what they need so the team can follow up";

const MAX_PROMPT_CHARS = 4000;

function line(label: string, value?: string | null): string {
  const v = String(value ?? "").trim();
  return v ? `${label}: ${v}\n` : "";
}

/** Deterministic, predictable instructions built straight from the captured knowledge. */
export function buildCaraCustomPromptFallback(
  input: CaraCustomPromptInput,
): string {
  const name = input.businessName.trim() || "the business";
  const type = input.businessType.trim();
  const parts: string[] = [];

  parts.push(
    `You are Cara, the phone assistant for ${name}${type ? ` (${type})` : ""}. Be warm, concise, and professional. Speak naturally and never invent details you weren't given.`,
  );

  let context = "";
  context += line("About the business", input.knowledgeSummary);
  context += line("Services offered", input.servicesOffered);
  context += line("Not offered (never promise these)", input.servicesNotOffered);
  context += line("Opening hours", input.openingHours);
  context += line("Areas covered", input.serviceArea);
  context += line("Collect on every call", input.detailsToCollect);
  if (context.trim()) {
    parts.push(`Business context:\n${context.trim()}`);
  }

  if (input.businessRules && input.businessRules.length > 0) {
    parts.push(
      `Always follow these rules:\n${input.businessRules
        .map((r) => `- ${r.trim()}`)
        .filter((r) => r.length > 2)
        .join("\n")}`,
    );
  }

  if (input.faqs && input.faqs.length > 0) {
    const faqText = input.faqs
      .filter((f) => f.question.trim())
      .slice(0, 12)
      .map((f) => `Q: ${f.question.trim()}\nA: ${f.answer.trim() || "(check with the team)"}`)
      .join("\n");
    if (faqText) parts.push(`Answer common questions:\n${faqText}`);
  }

  const fallbackNote = (input.fallbackNote ?? "").trim() || DEFAULT_FALLBACK_NOTE;
  const routes = (input.routes ?? []).filter((r) => r.trigger.trim());

  if (routes.length > 0) {
    const lines = routes.map(
      (r) => `- If they ask about ${r.trigger.trim()}, ${r.action.trim()}.`,
    );
    parts.push(
      [
        "Handling requests — match what the caller wants to ONE of the things below and do just that:",
        lines.join("\n"),
        `- If it is none of the above, ${fallbackNote}.`,
        "Match on meaning, not exact words. Only act when you are confident. If two could fit, ask one short question to confirm before you act. Never invent links, files, prices, or details you were not given.",
      ].join("\n"),
    );
  } else if (input.routingActions && input.routingActions.length > 0) {
    parts.push(
      `What you can do for callers:\n${input.routingActions
        .map((a) => `- ${a}`)
        .join("\n")}`,
    );
  }

  if (input.transferNumber && input.transferNumber.trim()) {
    parts.push(
      `If you can't help or the caller asks for a person, offer to transfer them to ${input.transferNumber.trim()}. Otherwise ${fallbackNote}.`,
    );
  } else {
    parts.push(
      `If you can't help, ${fallbackNote}.`,
    );
  }

  return parts.join("\n\n").slice(0, MAX_PROMPT_CHARS);
}

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
