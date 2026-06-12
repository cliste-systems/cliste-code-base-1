export const ONBOARDING_BUSINESS_TYPE_OPTIONS = [
  { value: "hair_salon", label: "Salon" },
  { value: "barber", label: "Barber" },
  { value: "other", label: "Other" },
] as const;

export type OnboardingBusinessType =
  (typeof ONBOARDING_BUSINESS_TYPE_OPTIONS)[number]["value"];

const NICHE_DESCRIPTION_FALLBACK: Record<string, string> = {
  hair_salon: "Hair salon",
  barber: "Barber",
  beauty: "Beauty salon",
  trades: "Trades business",
  home_services: "Home services business",
  hospitality: "Hospitality business",
  retail: "Retail shop",
  ecommerce: "Online shop",
  professional_services: "Professional services firm",
  fitness: "Fitness studio",
  automotive: "Automotive business",
  events: "Events business",
  education: "Training provider",
};

export function defaultBusinessDescription(input: {
  niche?: string | null | undefined;
  agentBusinessType: string | null | undefined;
}): string {
  const stored = String(input.agentBusinessType ?? "").trim();
  if (stored) return stored;
  // Fresh signups inherit the DB default niche (`hair_salon`) before profile step —
  // never prefill the form from that placeholder; the owner should describe their business.
  return "";
}

/** Label for a saved niche when agent_business_type is empty (admin / legacy rows). */
export function businessDescriptionFromNiche(
  niche: string | null | undefined,
): string {
  const key = String(niche ?? "").trim();
  return NICHE_DESCRIPTION_FALLBACK[key] ?? "";
}
