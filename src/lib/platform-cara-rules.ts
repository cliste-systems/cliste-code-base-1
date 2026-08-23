import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_PLATFORM_CARA_RULES,
  type PlatformCaraRules,
  validatePlatformCaraRulesInput,
} from "@/lib/platform-cara-rules-shared";

export type { PlatformCaraRules } from "@/lib/platform-cara-rules-shared";
export {
  DEFAULT_PLATFORM_CARA_RULES,
  platformCaraRulesFormDefaults,
  renderLegalDisclosure,
  validatePlatformCaraRulesInput,
} from "@/lib/platform-cara-rules-shared";

type PlatformCaraRulesRow = {
  legal_disclosure_template: string;
  platform_behaviour_rules: string[] | null;
  transfer_when_enabled: string;
  transfer_when_disabled: string;
  routing_protocol: string;
  updated_at: string;
  updated_by: string | null;
};

function rowToRules(row: PlatformCaraRulesRow): PlatformCaraRules {
  return {
    legalDisclosureTemplate: row.legal_disclosure_template.trim(),
    platformBehaviourRules: (row.platform_behaviour_rules ?? [])
      .map((r) => r.trim())
      .filter(Boolean),
    transferWhenEnabled: row.transfer_when_enabled.trim(),
    transferWhenDisabled: row.transfer_when_disabled.trim(),
    routingProtocol: row.routing_protocol.trim(),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export async function loadPlatformCaraRules(
  supabase: SupabaseClient,
): Promise<PlatformCaraRules> {
  const { data, error } = await supabase
    .from("platform_cara_rules")
    .select(
      "legal_disclosure_template, platform_behaviour_rules, transfer_when_enabled, transfer_when_disabled, routing_protocol, updated_at, updated_by",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_PLATFORM_CARA_RULES };
  }

  return rowToRules(data as PlatformCaraRulesRow);
}

export async function savePlatformCaraRules(
  supabase: SupabaseClient,
  input: PlatformCaraRules,
  updatedBy: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const validation = validatePlatformCaraRulesInput(input);
  if (validation) return { ok: false, message: validation };

  const rules = input.platformBehaviourRules.map((r) => r.trim()).filter(Boolean);

  const { error } = await supabase.from("platform_cara_rules").upsert(
    {
      id: 1,
      legal_disclosure_template: input.legalDisclosureTemplate.trim(),
      platform_behaviour_rules: rules,
      transfer_when_enabled: input.transferWhenEnabled.trim(),
      transfer_when_disabled: input.transferWhenDisabled.trim(),
      routing_protocol: input.routingProtocol.trim(),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "id" },
  );

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
