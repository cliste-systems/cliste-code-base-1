import type { AgentFaq } from "./agent-faqs";
import type { WeekSchedule } from "@/lib/business-hours";
import {
  assistantNameLabel,
  buildDefaultVoiceGreeting,
  businessNameLabel,
  DEFAULT_GREETING_CLOSING,
} from "@/lib/voice-greeting";

export type AgentSetupInitial = {
  businessName: string;
  assistantDisplayName: string;
  greeting: string;
  businessType: string;
  faqs: AgentFaq[];
  openingHoursSchedule: WeekSchedule;
  openingHoursLegacy?: string;
  hoursNeverConfigured: boolean;
  open24_7: boolean;
  hoursNote: string;
  serviceAreaItems: string[];
  serviceAreaExclusionItems: string[];
  servicesItems: string[];
  servicesNotOfferedItems: string[];
  detailsToCollectItems: string[];
  businessRules: string[];
  locationAddress: string;
  locationEircode: string;
};

export { assistantNameLabel, businessNameLabel };

/** Compliant default: AI + recording disclosure (Irish / EU AI Act). */
export function buildDefaultGreeting(
  businessName: string,
  assistantDisplayName: string,
): string {
  return buildDefaultVoiceGreeting(
    businessName,
    assistantDisplayName,
    DEFAULT_GREETING_CLOSING,
  );
}

export function defaultGreetingPreview(
  businessName: string,
  assistantDisplayName: string,
): string {
  return buildDefaultGreeting(businessName, assistantDisplayName);
}

export function greetingPreview(greeting: string): string | null {
  const t = greeting.trim();
  if (!t) return null;
  return t;
}
