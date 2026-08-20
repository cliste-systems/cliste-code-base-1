import type { AdminStoreSetupData } from "@/lib/retail-store-types";
import { isBusinessHoursUnset, parseBusinessHoursBundle } from "@/lib/business-hours";
import {
  buildFullVoiceGreeting,
  parseGreetingParts,
  voiceLegalDisclosure,
} from "@/lib/voice-greeting";

export type StoreSetupStepId =
  | "identity"
  | "numbers"
  | "people"
  | "departments"
  | "facts"
  | "hours"
  | "call_flow"
  | "greeting"
  | "prompt"
  | "go_live"
  | "diagnostics";

export type StoreSetupStepStatus = {
  id: StoreSetupStepId;
  label: string;
  complete: boolean;
  detail: string;
};

export const STORE_SETUP_STEP_ORDER: {
  id: StoreSetupStepId;
  label: string;
}[] = [
  { id: "identity", label: "Store identity" },
  { id: "numbers", label: "Numbers & divert" },
  { id: "people", label: "People" },
  { id: "departments", label: "Departments" },
  { id: "facts", label: "Store facts" },
  { id: "hours", label: "Opening hours" },
  { id: "call_flow", label: "Call flow" },
  { id: "greeting", label: "Greeting & voice" },
  { id: "prompt", label: "Prompt" },
  { id: "go_live", label: "Go-live" },
  { id: "diagnostics", label: "Diagnostics" },
];

function greetingHasLegalDisclosure(data: AdminStoreSetupData): boolean {
  const legal = voiceLegalDisclosure(data.assistantDisplayName);
  return data.greeting.includes(legal);
}

export function evaluateStoreSetupReadiness(
  data: AdminStoreSetupData,
): StoreSetupStepStatus[] {
  const activeDepartments = data.departments.filter((d) => d.active);
  const activeContacts = data.contacts.filter((c) => c.active);
  const hasManager = activeContacts.some((c) => c.role === "store_manager");
  const hasNotificationTarget =
    activeContacts.some((c) => c.is_notification_target) ||
    Boolean(data.contacts.length === 0);

  const hoursUnset = isBusinessHoursUnset(data.businessHours);
  const { meta } = hoursUnset
    ? { meta: { bankHolidays: { configured: false } } }
    : parseBusinessHoursBundle(data.businessHours);
  const bankHolidaysConfigured = meta.bankHolidays?.configured === true;

  const identityComplete =
    Boolean(data.storeCode.trim()) &&
    Boolean(data.retailBanner) &&
    Boolean(data.agentLocationAddress.trim()) &&
    Boolean(data.agentLocationEircode.trim());

  const numbersComplete =
    Boolean(data.phoneNumber.trim()) &&
    Boolean(data.storePublicNumber.trim()) &&
    Boolean(data.divertCarrier) &&
    Boolean(data.divertVerifiedAt);

  const peopleComplete = hasManager && hasNotificationTarget;

  const departmentsComplete =
    activeDepartments.length >= 2 &&
    activeDepartments.some((d) => d.name.toLowerCase().includes("customer"));

  const factsComplete =
    data.retailFacilities.length > 0 ||
    Boolean(data.retailClickCollectUrl.trim()) ||
    Boolean(data.retailLoyaltyProgram.trim());

  const hoursComplete = !hoursUnset && bankHolidaysConfigured;

  const routingLinks = Array.isArray(data.routingLinks) ? data.routingLinks : [];
  const callFlowComplete = routingLinks.length >= 3;

  const greetingComplete =
    Boolean(data.greeting.trim()) && greetingHasLegalDisclosure(data);

  const promptComplete =
    Boolean(data.customPrompt.trim()) &&
    data.promptCompileWarnings.length === 0;

  const goLiveComplete = data.isActive && Boolean(data.caraOnlineSince);

  return STORE_SETUP_STEP_ORDER.map(({ id, label }) => {
    switch (id) {
      case "identity":
        return {
          id,
          label,
          complete: identityComplete,
          detail: identityComplete
            ? "Store code, banner, and address on file."
            : "Add store code, banner, and full address.",
        };
      case "numbers":
        return {
          id,
          label,
          complete: numbersComplete,
          detail: numbersComplete
            ? "Cliste DID assigned and divert verified."
            : "Assign DID, set public number, carrier, and verify divert.",
        };
      case "people":
        return {
          id,
          label,
          complete: peopleComplete,
          detail: peopleComplete
            ? "Store manager and alert targets configured."
            : "Add a store manager and at least one notification target.",
        };
      case "departments":
        return {
          id,
          label,
          complete: departmentsComplete,
          detail: departmentsComplete
            ? `${activeDepartments.length} departments active.`
            : "Add departments (customer service + counters).",
        };
      case "facts":
        return {
          id,
          label,
          complete: factsComplete,
          detail: factsComplete
            ? "Retail facts captured."
            : "Set facilities, delivery, or click & collect URL.",
        };
      case "hours":
        return {
          id,
          label,
          complete: hoursComplete,
          detail: hoursComplete
            ? "Store hours and bank holidays set."
            : "Configure opening hours and bank holidays.",
        };
      case "call_flow":
        return {
          id,
          label,
          complete: callFlowComplete,
          detail: callFlowComplete
            ? "Retail route pack in place."
            : "Seed or review call flow routes.",
        };
      case "greeting":
        return {
          id,
          label,
          complete: greetingComplete,
          detail: greetingComplete
            ? "Composed greeting includes legal disclosure."
            : "Set intro + legal disclosure + closing.",
        };
      case "prompt":
        return {
          id,
          label,
          complete: promptComplete,
          detail: promptComplete
            ? "Prompt compiled without warnings."
            : "Recompile prompt and resolve warnings.",
        };
      case "go_live":
        return {
          id,
          label,
          complete: goLiveComplete,
          detail: goLiveComplete
            ? "Store is live."
            : "Complete checklist and activate store.",
        };
      case "diagnostics":
        return {
          id,
          label,
          complete: true,
          detail: "Review calls and webhook health after go-live.",
        };
      default:
        return { id, label, complete: false, detail: "" };
    }
  });
}

export function allGoLiveStepsComplete(statuses: StoreSetupStepStatus[]): boolean {
  const required = statuses.filter(
    (s) => s.id !== "go_live" && s.id !== "diagnostics",
  );
  return required.every((s) => s.complete);
}

export function parseAdminGreetingParts(data: AdminStoreSetupData) {
  const defaultIntro = `You're through to ${data.name || "the store"} —`;
  return parseGreetingParts(
    data.greeting,
    data.assistantDisplayName,
    defaultIntro,
  );
}

export function composeAdminGreeting(
  data: AdminStoreSetupData,
  intro: string,
  closing: string,
): string {
  return buildFullVoiceGreeting(intro, data.assistantDisplayName, closing);
}
