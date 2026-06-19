export const BUSINESS_RULE_PRESET_PREFIX = "preset:";

export type BusinessRulePreset = {
  id: string;
  label: string;
  compile: string;
};

export const BUSINESS_RULE_PRESETS: BusinessRulePreset[] = [
  {
    id: "preset:no_walk_ins",
    label: "No walk-ins",
    compile:
      "We don't take walk-ins — callers need an appointment or the team will call them back.",
  },
  {
    id: "preset:24h_cancellation",
    label: "24h cancellation notice",
    compile:
      "Cancellations need at least 24 hours' notice or a fee may apply — I don't quote the fee, I take their details for the team.",
  },
  {
    id: "preset:deposit_colour",
    label: "Deposit for colour",
    compile:
      "Colour appointments need a deposit — I don't take payment on the call, I explain that and take their details or send the booking link.",
  },
  {
    id: "preset:over_18",
    label: "Over-18s only",
    compile: "Callers must be 18 or over for our services.",
  },
  {
    id: "preset:never_quote_prices",
    label: "Never quote prices on calls",
    compile:
      "I never quote prices over the phone — I offer to text the price list or booking link, or take their details for the team.",
  },
];

export const MAX_CUSTOM_BUSINESS_RULES = 5;

const presetById = new Map(
  BUSINESS_RULE_PRESETS.map((preset) => [preset.id, preset]),
);

export function isBusinessRulePresetId(value: string): boolean {
  return value.startsWith(BUSINESS_RULE_PRESET_PREFIX);
}

export function businessRulePresetLabel(value: string): string | null {
  return presetById.get(value)?.label ?? null;
}

/** Resolve stored rule (preset id or free text) to prompt text. */
export function resolveBusinessRuleForPrompt(value: string): string {
  const preset = presetById.get(value.trim());
  return preset?.compile ?? value.trim();
}

export function splitBusinessRulesForStorage(rules: string[]): {
  presetIds: string[];
  customRules: string[];
} {
  const presetIds: string[] = [];
  const customRules: string[] = [];

  for (const rule of rules) {
    const trimmed = rule.trim();
    if (!trimmed) continue;
    if (isBusinessRulePresetId(trimmed)) {
      if (presetById.has(trimmed)) presetIds.push(trimmed);
      continue;
    }
    customRules.push(trimmed);
  }

  return { presetIds, customRules };
}
