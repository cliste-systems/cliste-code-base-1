import type { AgentFaq } from "./agent-faqs";
import type { WeekSchedule } from "@/lib/business-hours";
import type { DetailsCollectMode } from "@/lib/details-collect-mode";
import { assistantNameLabel, businessNameLabel } from "@/lib/voice-greeting";

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
  detailsCollectMode: DetailsCollectMode;
  businessRules: string[];
  locationAddress: string;
  locationEircode: string;
  baseTown: string;
};

export { assistantNameLabel, businessNameLabel };
