import { isBusinessHoursUnset, parseBusinessHoursBundle } from "@/lib/business-hours";
import { greetingDisclosesAi } from "@/lib/greeting-discloses-ai";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";
import type { StorePhoneSystemRow } from "@/lib/store-transfer-capability";
import { voiceLegalDisclosure } from "@/lib/voice-greeting";

export type AdminCaraTrainingReadinessInput = {
  assistantDisplayName: string;
  agentVoiceId: string;
  /** Full stored greeting — used by provisioning when intro/closing not parsed. */
  greeting?: string;
  greetingIntro: string;
  greetingClosing: string;
  agentBusinessType: string;
  businessKnowledgeSummary: string;
  departments: Pick<StoreDepartmentRow, "name" | "active">[];
  /** Fallback when structured departments not loaded (provisioning). */
  legacyDepartments?: unknown;
  agentServicesNotOffered: string;
  agentExtraNotes: string;
  businessHours: unknown;
  agentFaqs: { question: string; answer: string }[];
  agentDetailsToCollect: string;
  phoneSystem: StorePhoneSystemRow | null;
  canTransfer: boolean;
  quotePricesOnCalls?: boolean;
  customPrompt: string;
  promptCompileWarnings: unknown;
};

export type AdminCaraTrainingSectionId =
  | "identity"
  | "storeFacts"
  | "departments"
  | "people"
  | "phoneSystem"
  | "boundaries"
  | "faqs"
  | "fallback"
  | "review";

export type AdminCaraTrainingSectionCheck = {
  id: AdminCaraTrainingSectionId;
  label: string;
  complete: boolean;
  detail: string;
};

function hasCompileWarnings(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0;
}

function departmentsFromLegacy(raw: unknown): Pick<StoreDepartmentRow, "name" | "active">[] {
  if (Array.isArray(raw)) {
    return raw
      .map((d) => {
        if (typeof d === "string") return { name: d.trim(), active: true };
        if (d && typeof d === "object" && "name" in d) {
          return {
            name: String((d as { name: unknown }).name ?? "").trim(),
            active: (d as { active?: boolean }).active !== false,
          };
        }
        return null;
      })
      .filter((d): d is Pick<StoreDepartmentRow, "name" | "active"> => Boolean(d?.name));
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,;\n]+/)
      .map((name) => ({ name: name.trim(), active: true }))
      .filter((d) => d.name);
  }
  return [];
}

function departmentsForCheck(
  input: AdminCaraTrainingReadinessInput,
): Pick<StoreDepartmentRow, "name" | "active">[] {
  const departments = input.departments ?? [];
  if (departments.length > 0) return departments;
  return departmentsFromLegacy(input.legacyDepartments);
}

function activeDepartments(
  departments: Pick<StoreDepartmentRow, "name" | "active">[],
): string[] {
  return departments
    .filter((d) => d.active)
    .map((d) => d.name.trim())
    .filter(Boolean);
}

function greetingPreview(input: AdminCaraTrainingReadinessInput): string {
  return [
    String(input.greetingIntro ?? "").trim(),
    voiceLegalDisclosure(input.assistantDisplayName),
    String(input.greetingClosing ?? "").trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

function greetingForCheck(input: AdminCaraTrainingReadinessInput): string {
  const composed = greetingPreview(input);
  if (composed.trim()) return composed;
  return String(input.greeting ?? "").trim();
}

export function adminCaraTrainingSectionChecks(
  input: AdminCaraTrainingReadinessInput,
): AdminCaraTrainingSectionCheck[] {
  const greeting = greetingForCheck(input);
  const identityComplete =
    Boolean(String(input.assistantDisplayName ?? "").trim()) &&
    Boolean(String(input.agentVoiceId ?? "").trim()) &&
    Boolean(greeting.trim()) &&
    greetingDisclosesAi(greeting, input.assistantDisplayName);

  const hoursUnset = isBusinessHoursUnset(input.businessHours);
  const { meta } = hoursUnset
    ? { meta: { bankHolidays: { configured: false }, open24_7: false } }
    : parseBusinessHoursBundle(input.businessHours);
  const hoursComplete =
    !hoursUnset && meta.bankHolidays?.configured === true;

  const storeFactsComplete =
    Boolean(input.agentBusinessType.trim()) &&
    Boolean(input.businessKnowledgeSummary.trim()) &&
    hoursComplete;

  const deptNames = activeDepartments(departmentsForCheck(input));
  const departmentsComplete = deptNames.length >= 1;

  const peopleComplete = true;

  const phoneSystemComplete =
    input.phoneSystem !== null &&
    input.phoneSystem.warm_transfer_hardware_status !== "unknown";

  const boundariesComplete =
    Boolean(input.agentServicesNotOffered.trim()) &&
    Boolean(input.agentExtraNotes.trim()) &&
    input.quotePricesOnCalls !== undefined;

  const faqsComplete = input.agentFaqs.filter(
    (f) => f.question.trim() && f.answer.trim(),
  ).length >= 3;

  const fallbackComplete = Boolean(input.agentDetailsToCollect.trim());

  const promptComplete =
    Boolean(input.customPrompt.trim()) &&
    !hasCompileWarnings(input.promptCompileWarnings);

  return [
    {
      id: "identity",
      label: "Identity & voice",
      complete: identityComplete,
      detail: identityComplete
        ? "Assistant name, voice, and compliant greeting saved."
        : "Set voice ID and greeting with AI disclosure.",
    },
    {
      id: "storeFacts",
      label: "Store facts",
      complete: storeFactsComplete,
      detail: storeFactsComplete
        ? "Business type, knowledge summary, and bank holidays configured."
        : "Complete store facts and bank holiday hours.",
    },
    {
      id: "departments",
      label: "Departments",
      complete: departmentsComplete,
      detail: departmentsComplete
        ? `${deptNames.length} active department(s).`
        : "Add at least one active department.",
    },
    {
      id: "people",
      label: "People & escalation",
      complete: peopleComplete,
      detail: "Optional — configure store contacts when known.",
    },
    {
      id: "phoneSystem",
      label: "Phone system",
      complete: phoneSystemComplete,
      detail: phoneSystemComplete
        ? "Phone system and transfer hardware status recorded."
        : "Record phone system type and warm-transfer hardware status.",
    },
    {
      id: "boundaries",
      label: "Boundaries",
      complete: boundariesComplete,
      detail: boundariesComplete
        ? "Services not offered, extra notes, and price policy set."
        : "Complete boundaries and price-on-calls choice.",
    },
    {
      id: "faqs",
      label: "Common questions",
      complete: faqsComplete,
      detail: faqsComplete
        ? `${input.agentFaqs.length} FAQ(s) saved.`
        : "Add at least three reviewed FAQ answers.",
    },
    {
      id: "fallback",
      label: "When Cara can't answer",
      complete: fallbackComplete,
      detail: fallbackComplete
        ? "Fallback details-to-collect configured."
        : "Set what Cara collects when she cannot answer.",
    },
    {
      id: "review",
      label: "Review & publish",
      complete: promptComplete,
      detail: promptComplete
        ? "Compiled prompt saved with no warnings."
        : "Save all sections and resolve compile warnings.",
    },
  ];
}

export function isAdminCaraTrainingComplete(
  input: AdminCaraTrainingReadinessInput,
): boolean {
  const checks = adminCaraTrainingSectionChecks(input);
  return checks
    .filter((c) => c.id !== "people")
    .every((c) => c.complete);
}

export function adminCaraTrainingReadinessDetail(
  input: AdminCaraTrainingReadinessInput,
): { complete: boolean; detail: string } {
  const complete = isAdminCaraTrainingComplete(input);
  const incomplete = adminCaraTrainingSectionChecks(input).filter(
    (c) => !c.complete && c.id !== "people",
  );
  return {
    complete,
    detail: complete
      ? "All Cara training sections complete."
      : incomplete.length > 0
        ? `Incomplete: ${incomplete.map((c) => c.label).join(", ")}.`
        : "Complete every section in Cara training and save.",
  };
}
