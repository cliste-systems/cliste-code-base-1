import type { CaraCapabilities } from "@/lib/cara-capabilities";
import { validateCallHandlingAdd } from "@/lib/call-handling-boundary";
import { detectPromptInjectionViolation } from "@/lib/prompt-injection-guard";
import {
  formatServiceCatalogLine,
  MAX_SERVICE_VOICE_NOTES,
  type ServiceCatalogItem,
  type ServiceCatalogDraft,
} from "@/lib/service-catalog-format";

/** Escape double quotes in owner free text embedded in quoted prompt lines. */
export function sanitizePromptFreeText(text: string): string {
  return text.replace(/"/g, "'");
}

export type ServicePolicyFlagType =
  | "patch_test"
  | "consultation_required"
  | "extra_time"
  | "no_pregnancy"
  | "over_18"
  | "appointment_only"
  | "walk_ins_welcome";

export type ServicePolicyFlag =
  | { type: "patch_test"; hours: number }
  | { type: "consultation_required" }
  | { type: "extra_time" }
  | { type: "no_pregnancy" }
  | { type: "over_18" }
  | { type: "appointment_only" }
  | { type: "walk_ins_welcome" };

export type ServicePolicyPreset = {
  type: ServicePolicyFlagType;
  label: string;
  compile: (flag: ServicePolicyFlag) => string;
};

export const PATCH_TEST_HOURS_DEFAULT = 48;
export const PATCH_TEST_HOURS_MIN = 1;
export const PATCH_TEST_HOURS_MAX = 168;

const ALL_SERVICE_POLICY_PRESETS: ServicePolicyPreset[] = [
  {
    type: "patch_test",
    label: "Patch test required",
    compile: (flag) => {
      const hours =
        flag.type === "patch_test"
          ? clampPatchTestHours(flag.hours)
          : PATCH_TEST_HOURS_DEFAULT;
      return `A patch test is needed ${hours} hours before a first colour appointment.`;
    },
  },
  {
    type: "consultation_required",
    label: "Consultation required first",
    compile: () => "This needs a quick consultation first.",
  },
  {
    type: "extra_time",
    label: "Allow extra time",
    compile: () => "This can run a little longer than booked.",
  },
  {
    type: "no_pregnancy",
    label: "Not suitable during pregnancy",
    compile: () => "We don't offer this during pregnancy.",
  },
  {
    type: "over_18",
    label: "Over-18s only",
    compile: () => "This is for over-18s only.",
  },
  {
    type: "appointment_only",
    label: "Appointment only (no walk-ins)",
    compile: () => "This is by appointment only.",
  },
  {
    type: "walk_ins_welcome",
    label: "Walk-ins welcome",
    compile: () => "Walk-ins are welcome for this service.",
  },
];

/** v1 UI presets — excludes walk-ins / appointment-only (registry-only). */
export const SALON_SERVICE_POLICY_PRESETS = ALL_SERVICE_POLICY_PRESETS.filter(
  (preset) =>
    preset.type !== "walk_ins_welcome" && preset.type !== "appointment_only",
);

export const MUTUALLY_EXCLUSIVE_POLICY_PAIRS: readonly (readonly ServicePolicyFlagType[])[] =
  [["appointment_only", "walk_ins_welcome"]];

const presetByType = new Map(
  ALL_SERVICE_POLICY_PRESETS.map((preset) => [preset.type, preset]),
);

const VALID_POLICY_TYPES = new Set<ServicePolicyFlagType>(
  ALL_SERVICE_POLICY_PRESETS.map((p) => p.type),
);

function clampPatchTestHours(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return PATCH_TEST_HOURS_DEFAULT;
  return Math.min(PATCH_TEST_HOURS_MAX, Math.max(PATCH_TEST_HOURS_MIN, n));
}

function parsePolicyFlag(raw: unknown): ServicePolicyFlag | null {
  if (!raw || typeof raw !== "object") return null;
  const type = (raw as { type?: unknown }).type;
  if (typeof type !== "string" || !VALID_POLICY_TYPES.has(type as ServicePolicyFlagType)) {
    return null;
  }

  switch (type) {
    case "patch_test":
      return {
        type: "patch_test",
        hours: clampPatchTestHours((raw as { hours?: unknown }).hours),
      };
    case "consultation_required":
      return { type: "consultation_required" };
    case "extra_time":
      return { type: "extra_time" };
    case "no_pregnancy":
      return { type: "no_pregnancy" };
    case "over_18":
      return { type: "over_18" };
    case "appointment_only":
      return { type: "appointment_only" };
    case "walk_ins_welcome":
      return { type: "walk_ins_welcome" };
    default:
      return null;
  }
}

export function normalizeServicePolicyFlags(raw: unknown): ServicePolicyFlag[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<ServicePolicyFlagType>();
  const out: ServicePolicyFlag[] = [];

  for (const item of raw) {
    const flag = parsePolicyFlag(item);
    if (!flag || seen.has(flag.type)) continue;
    seen.add(flag.type);
    out.push(flag);
  }

  return out;
}

function conflictingTypes(type: ServicePolicyFlagType): ServicePolicyFlagType[] {
  const conflicts: ServicePolicyFlagType[] = [];
  for (const pair of MUTUALLY_EXCLUSIVE_POLICY_PAIRS) {
    if (pair[0] === type) conflicts.push(pair[1]!);
    if (pair[1] === type) conflicts.push(pair[0]!);
  }
  return conflicts;
}

export function isServicePolicyFlagSelected(
  flags: ServicePolicyFlag[],
  type: ServicePolicyFlagType,
): boolean {
  return flags.some((f) => f.type === type);
}

export function toggleServicePolicyFlag(
  flags: ServicePolicyFlag[],
  type: ServicePolicyFlagType,
  params?: { hours?: number },
): ServicePolicyFlag[] {
  if (isServicePolicyFlagSelected(flags, type)) {
    return flags.filter((f) => f.type !== type);
  }

  const withoutConflicts = flags.filter(
    (f) => !conflictingTypes(type).includes(f.type),
  );

  if (type === "patch_test") {
    return [
      ...withoutConflicts,
      {
        type: "patch_test",
        hours: clampPatchTestHours(params?.hours ?? PATCH_TEST_HOURS_DEFAULT),
      },
    ];
  }

  return [...withoutConflicts, { type } as ServicePolicyFlag];
}

export function updatePatchTestHours(
  flags: ServicePolicyFlag[],
  hours: number,
): ServicePolicyFlag[] {
  if (!isServicePolicyFlagSelected(flags, "patch_test")) return flags;
  const clamped = clampPatchTestHours(hours);
  return flags.map((f) =>
    f.type === "patch_test" ? { type: "patch_test", hours: clamped } : f,
  );
}

export function compileServicePolicySentences(
  flags: ServicePolicyFlag[],
): string[] {
  const normalized = normalizeServicePolicyFlags(flags);
  const sentences: string[] = [];

  for (const flag of normalized) {
    const preset = presetByType.get(flag.type);
    if (!preset) continue;
    sentences.push(preset.compile(flag));
  }

  return sentences;
}

export function compileServiceCatalogKnowledgeLine(
  item: Pick<
    ServiceCatalogItem,
    "name" | "price" | "durationMinutes" | "policyFlags" | "aiVoiceNotes"
  >,
): string {
  const base = formatServiceCatalogLine(item);
  const parts: string[] = [base];

  const presetSentences = compileServicePolicySentences(item.policyFlags ?? []);
  parts.push(...presetSentences);

  const note = item.aiVoiceNotes?.trim();
  if (note) {
    parts.push(`About ${item.name.trim()}: ${note}`);
  }

  return parts.join(" ");
}

export function sanitizeServiceVoiceNote(
  raw: string | null | undefined,
): string | null {
  const collapsed = String(raw ?? "")
    .trim()
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ");
  if (!collapsed) return null;
  const capped = collapsed.slice(0, MAX_SERVICE_VOICE_NOTES);
  return sanitizePromptFreeText(capped);
}

export type ServiceVoiceNoteValidation =
  | { ok: true; warnings?: string[] }
  | { ok: false; block: string };

export function validateServiceVoiceNote(
  text: string | null | undefined,
  caps: CaraCapabilities,
): ServiceVoiceNoteValidation {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return { ok: true };

  const injection = detectPromptInjectionViolation(trimmed);
  if (injection) return { ok: false, block: injection.message };

  const handling = validateCallHandlingAdd(trimmed, "rule", caps);
  if (!handling.ok) return { ok: false, block: handling.block };

  return {
    ok: true,
    warnings: handling.warnings,
  };
}

export function assertServiceVoiceNoteAllowed(
  text: string | null | undefined,
  caps: CaraCapabilities,
): string | null {
  const result = validateServiceVoiceNote(text, caps);
  if (!result.ok) return result.block;
  return null;
}

export function voiceNoteBlockForCatalogDrafts(
  drafts: Array<Pick<ServiceCatalogDraft, "name" | "aiVoiceNotes">>,
  caps: CaraCapabilities,
): string | null {
  for (const draft of drafts) {
    const block = assertServiceVoiceNoteAllowed(draft.aiVoiceNotes, caps);
    if (block) {
      const label = draft.name.trim() || "A service";
      return `${label}: ${block}`;
    }
  }
  return null;
}
