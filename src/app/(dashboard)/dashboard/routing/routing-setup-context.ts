import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import {
  callRoutingAllowsHumanTransfer,
  parseCallRoutingMode,
} from "@/lib/call-routing";
import {
  buildFullVoiceGreeting,
  defaultVoiceGreetingIntro,
  parseGreetingParts,
  resolveVoiceGreetingPreview,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "@/lib/voice-greeting";

/** Read-only Cara Setup fields shown in the Call Flow baseline panel. */
export type RoutingSetupContext = {
  greetingPreview: string;
  detailsToCollect: string[];
  /** What you offer — from Cara Setup → Services. */
  servicesOffered: string[];
  servicesNotOffered: string[];
  transferNumber: string;
  transferAllowed: boolean;
  niche: string;
  businessName: string;
};

export const EMPTY_ROUTING_SETUP_CONTEXT: RoutingSetupContext = {
  greetingPreview: "",
  detailsToCollect: [],
  servicesOffered: [],
  servicesNotOffered: [],
  transferNumber: "",
  transferAllowed: false,
  niche: "",
  businessName: "",
};

type OrgSetupRow = {
  name?: string | null;
  greeting?: string | null;
  agent_details_to_collect?: string | null;
  agent_services_departments?: string | null;
  agent_services_not_offered?: string | null;
  fallback_number?: string | null;
  call_routing_mode?: string | null;
  niche?: string | null;
};

export function routingSetupContextFromOrg(
  org: OrgSetupRow | null | undefined,
): RoutingSetupContext {
  if (!org) return EMPTY_ROUTING_SETUP_CONTEXT;

  const businessName = (org.name as string | null)?.trim() ?? "";
  const assistant = VOICE_ASSISTANT_DEFAULT_NAME;
  const defaultIntro = defaultVoiceGreetingIntro(businessName);
  const parts = parseGreetingParts(
    (org.greeting as string | null) ?? "",
    assistant,
    defaultIntro,
  );
  const greetingPreview = resolveVoiceGreetingPreview(
    parts.intro,
    assistant,
    parts.closing,
  );

  const mode = parseCallRoutingMode(org.call_routing_mode);
  const transferNumber = String(org.fallback_number ?? "").trim();
  const transferAllowed =
    callRoutingAllowsHumanTransfer(mode) && Boolean(transferNumber);

  return {
    businessName,
    greetingPreview:
      greetingPreview ||
      buildFullVoiceGreeting(defaultIntro, assistant),
    detailsToCollect: parseAgentKnowledgeList(
      (org.agent_details_to_collect as string | null) ?? "",
    ),
    servicesOffered: parseAgentKnowledgeList(
      (org.agent_services_departments as string | null) ?? "",
    ),
    servicesNotOffered: parseAgentKnowledgeList(
      (org.agent_services_not_offered as string | null) ?? "",
    ),
    transferNumber,
    transferAllowed,
    niche: (org.niche as string | null)?.trim() ?? "",
  };
}
