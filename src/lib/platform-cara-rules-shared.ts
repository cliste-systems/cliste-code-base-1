import {
  assistantNameLabel,
  buildFullVoiceGreeting,
  defaultVoiceGreetingIntro,
  parseGreetingParts,
  voiceLegalDisclosure,
} from "@/lib/voice-greeting";

export type PlatformCaraRules = {
  legalDisclosureTemplate: string;
  platformBehaviourRules: string[];
  transferWhenEnabled: string;
  transferWhenDisabled: string;
  routingProtocol: string;
  updatedAt?: string;
  updatedBy?: string | null;
};

export const DEFAULT_LEGAL_DISCLOSURE_TEMPLATE =
  "I'm {assistant}, the AI assistant. This call may be recorded and transcribed.";

export const DEFAULT_TRANSFER_WHEN_ENABLED =
  "Built-in: when someone asks to speak to a person, I try to put them through when transfer is configured and allowed — otherwise I take a message. I never ring out in silence; if there's no answer I take their details.";

export const DEFAULT_TRANSFER_WHEN_DISABLED =
  "Built-in: when someone asks to speak to a person, I take their name, number, and what they need — I do not put callers through on this setup.";

export const DEFAULT_ROUTING_PROTOCOL = [
  'Before any send or transfer I propose and confirm: e.g. "I can text you the booking link — shall I send it to the number you\'re calling from?" After sending: "That\'s sent now."',
  "If they didn't receive a text, I resend once — then take their details with a delivery-failed note. If they decline an action, I answer from knowledge or take a message — I never insist.",
  'When they have several requests, I handle each in turn and ask "anything else?" before wrapping up.',
  "I match on meaning, not exact words. I never invent links, files, prices, or details.",
  "When texting a link or file, I confirm sending to the number they're calling from when caller ID shows a mobile — I do not ask them to recite their number. On landlines, failed SMS, or exhausted monthly SMS quota, I take a message and flag the owner — I never fail silently.",
].join("\n");

/** Retail stores do not take appointments — avoid booking-link examples in the default protocol. */
export const DEFAULT_RETAIL_ROUTING_PROTOCOL = [
  'Before any send or transfer I propose and confirm: e.g. "I can text you the directions link — shall I send it to the number you\'re calling from?" After sending: "That\'s sent now."',
  "If they didn't receive a text, I resend once — then take their details with a delivery-failed note. If they decline an action, I answer from knowledge or take a message — I never insist.",
  'When they have several requests, I handle each in turn and ask "anything else?" before wrapping up.',
  "I match on meaning, not exact words. I never invent links, files, prices, or details.",
  "When texting a link or file, I confirm sending to the number they're calling from when caller ID shows a mobile — I do not ask them to recite their number. On landlines, failed SMS, or exhausted monthly SMS quota, I take a message and flag the owner — I never fail silently.",
].join("\n");

export const DEFAULT_PLATFORM_CARA_RULES: PlatformCaraRules = {
  legalDisclosureTemplate: DEFAULT_LEGAL_DISCLOSURE_TEMPLATE,
  platformBehaviourRules: [],
  transferWhenEnabled: DEFAULT_TRANSFER_WHEN_ENABLED,
  transferWhenDisabled: DEFAULT_TRANSFER_WHEN_DISABLED,
  routingProtocol: DEFAULT_ROUTING_PROTOCOL,
};

export function resolvePlatformCaraRules(
  rules?: Partial<PlatformCaraRules> | null,
): PlatformCaraRules {
  if (!rules) return { ...DEFAULT_PLATFORM_CARA_RULES };
  return {
    legalDisclosureTemplate:
      rules.legalDisclosureTemplate?.trim() ||
      DEFAULT_PLATFORM_CARA_RULES.legalDisclosureTemplate,
    platformBehaviourRules:
      rules.platformBehaviourRules ??
      DEFAULT_PLATFORM_CARA_RULES.platformBehaviourRules,
    transferWhenEnabled:
      rules.transferWhenEnabled?.trim() ||
      DEFAULT_PLATFORM_CARA_RULES.transferWhenEnabled,
    transferWhenDisabled:
      rules.transferWhenDisabled?.trim() ||
      DEFAULT_PLATFORM_CARA_RULES.transferWhenDisabled,
    routingProtocol:
      rules.routingProtocol?.trim() ||
      DEFAULT_PLATFORM_CARA_RULES.routingProtocol,
    updatedAt: rules.updatedAt,
    updatedBy: rules.updatedBy,
  };
}

export function renderLegalDisclosure(
  template: string,
  assistantDisplayName: string,
): string {
  const assistant = assistantNameLabel(assistantDisplayName);
  const resolved = template.trim().replaceAll("{assistant}", assistant);
  if (!resolved.includes(assistant)) {
    throw new Error(
      "Legal disclosure template must include {assistant} or the assistant name.",
    );
  }
  return resolved;
}

export function validatePlatformCaraRulesInput(
  input: PlatformCaraRules,
): string | null {
  const template = input.legalDisclosureTemplate.trim();
  if (!template) return "Legal disclosure template is required.";
  if (!template.includes("{assistant}")) {
    return "Legal disclosure template must include {assistant}.";
  }
  try {
    renderLegalDisclosure(template, "Cara");
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid legal disclosure template.";
  }
  if (!input.transferWhenEnabled.trim()) {
    return "Transfer behaviour (when enabled) is required.";
  }
  if (!input.transferWhenDisabled.trim()) {
    return "Transfer behaviour (when disabled) is required.";
  }
  if (!input.routingProtocol.trim()) {
    return "Routing protocol is required.";
  }
  return null;
}

export function platformCaraRulesFormDefaults(): PlatformCaraRules {
  return { ...DEFAULT_PLATFORM_CARA_RULES };
}

export function reassembleOrgGreetingForPlatformRules(
  storedGreeting: string,
  businessName: string,
  assistantDisplayName: string,
  platformRules: PlatformCaraRules,
): string {
  const assistant = assistantNameLabel(assistantDisplayName);
  const defaultIntro = defaultVoiceGreetingIntro(businessName);
  const trimmed = storedGreeting.trim();

  if (!trimmed) {
    return buildFullVoiceGreeting(
      defaultIntro,
      assistant,
      undefined,
      platformRules.legalDisclosureTemplate,
    );
  }

  const templates = [
    platformRules.legalDisclosureTemplate,
    DEFAULT_LEGAL_DISCLOSURE_TEMPLATE,
  ];

  for (const template of templates) {
    const legal = voiceLegalDisclosure(assistant, template);
    if (!trimmed.includes(legal)) continue;
    const { intro, closing } = parseGreetingParts(
      trimmed,
      assistant,
      defaultIntro,
      template,
    );
    return buildFullVoiceGreeting(
      intro,
      assistant,
      closing,
      platformRules.legalDisclosureTemplate,
    );
  }

  return trimmed;
}
