export type HandleOptionDescriptionId =
  | "send_link"
  | "send_file"
  | "email_request"
  | "send_whatsapp"
  | "capture_quote_requests"
  | "book_meeting";

export type HandleOptionDescriptions = Partial<
  Record<HandleOptionDescriptionId, string>
>;

export type OnboardingUiCopy = {
  faqSuggestions: string[];
  faqStepHint: string;
  questionPlaceholder: string;
  answerPlaceholder: string;
  businessRuleSuggestions?: string[];
  businessRulesStepHint?: string;
  rulePlaceholder?: string;
  handleStepHint?: string;
  handleOptionDescriptions?: HandleOptionDescriptions;
  servicesStepSubtitle?: string;
  servicesOfferedLabel?: string;
  servicesOfferedPlaceholder?: string;
  servicesNotOfferedLabel?: string;
  servicesNotOfferedPlaceholder?: string;
  servicesStepHelper?: string;
  source: "openrouter" | "heuristic";
  contextKey: string;
};

export function buildOnboardingUiCopyContextKey(input: {
  businessType?: string | null;
  rawBusinessDescription: string;
}): string {
  const type = String(input.businessType ?? "").trim().toLowerCase();
  const description = String(input.rawBusinessDescription ?? "")
    .trim()
    .slice(0, 600)
    .toLowerCase();
  return `${type}::${description}`;
}

export function isOnboardingUiCopyFresh(
  copy: OnboardingUiCopy | null | undefined,
  input: {
    businessType?: string | null;
    rawBusinessDescription: string;
  },
): boolean {
  if (!copy?.contextKey) return false;
  return copy.contextKey === buildOnboardingUiCopyContextKey(input);
}
