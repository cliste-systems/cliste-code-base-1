import { isBusinessHoursUnset, parseBusinessHoursBundle } from "@/lib/business-hours";
import { greetingDisclosesAi } from "@/lib/greeting-discloses-ai";

export type AdminCaraTrainingReadinessInput = {
  assistantDisplayName: string;
  agentVoiceId: string;
  greeting: string;
  agentBusinessType: string;
  businessKnowledgeSummary: string;
  agentServicesDepartments: unknown;
  agentServicesNotOffered: string;
  agentExtraNotes: string;
  businessHours: unknown;
  customPrompt: string;
  promptCompileWarnings: unknown;
};

function parseDepartments(raw: unknown): string[] {
  if (typeof raw === "string") {
    return raw
      .split(/[,;\n]+/)
      .map((d) => d.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw.map((d) => String(d).trim()).filter(Boolean);
  }
  return [];
}

function hasCompileWarnings(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0;
}

export function isAdminCaraTrainingComplete(
  input: AdminCaraTrainingReadinessInput,
): boolean {
  const greetingComplete =
    Boolean(input.assistantDisplayName.trim()) &&
    Boolean(input.agentVoiceId.trim()) &&
    Boolean(input.greeting.trim()) &&
    greetingDisclosesAi(input.greeting, input.assistantDisplayName);

  const knowledgeComplete =
    Boolean(input.agentBusinessType.trim()) &&
    Boolean(input.businessKnowledgeSummary.trim()) &&
    parseDepartments(input.agentServicesDepartments).length >= 1 &&
    Boolean(input.agentServicesNotOffered.trim()) &&
    Boolean(input.agentExtraNotes.trim());

  const hoursUnset = isBusinessHoursUnset(input.businessHours);
  const { meta } = hoursUnset
    ? { meta: { bankHolidays: { configured: false }, open24_7: false } }
    : parseBusinessHoursBundle(input.businessHours);
  const hoursComplete =
    !hoursUnset && meta.bankHolidays?.configured === true;

  const promptComplete =
    Boolean(input.customPrompt.trim()) &&
    !hasCompileWarnings(input.promptCompileWarnings);

  return (
    greetingComplete &&
    knowledgeComplete &&
    hoursComplete &&
    promptComplete
  );
}

export function adminCaraTrainingReadinessDetail(
  input: AdminCaraTrainingReadinessInput,
): { complete: boolean; detail: string } {
  const complete = isAdminCaraTrainingComplete(input);
  return {
    complete,
    detail: complete
      ? "Greeting, knowledge, hours, and prompt saved."
      : "Complete every section in Cara training and save.",
  };
}
