import type { CallRoutingMode } from "@/lib/call-routing";
import type { DivertCarrier } from "@/lib/retail-store-types";

export type DivertInstruction = {
  title: string;
  steps: string[];
};

const CARRIER_INSTRUCTIONS: Record<
  DivertCarrier,
  (target: string, mode: CallRoutingMode) => DivertInstruction[]
> = {
  eir: (target, mode) => [
    {
      title: "Eir landline — via My Eir portal",
      steps: [
        "Sign in at eir.ie and open your fixed-line account.",
        mode === "forward_all"
          ? `Set unconditional divert to ${target || "<Cliste number>"}.`
          : "Set divert on no answer and when busy to the Cliste number.",
        "Save and wait a few minutes for the network to apply.",
      ],
    },
    {
      title: "Eir landline — via handset (if supported)",
      steps: [
        "Pick up the store handset.",
        mode === "forward_all"
          ? `Dial *21*${target.replace(/\D/g, "")}# and wait for confirmation tone.`
          : `Dial *61*${target.replace(/\D/g, "")}# for missed-call divert.`,
        "To cancel all diverts later: dial ##21#.",
      ],
    },
  ],
  vodafone: (target, mode) => [
    {
      title: "Vodafone fixed line",
      steps: [
        "Contact Vodafone Business or use the Vodafone portal for your fixed line.",
        mode === "forward_all"
          ? `Request unconditional call forwarding to ${target || "<Cliste number>"}.`
          : "Request divert on no answer and busy to the Cliste number.",
      ],
    },
  ],
  three: (target, mode) => [
    {
      title: "Three fixed line",
      steps: [
        "Contact Three Business support for your shop line.",
        mode === "forward_all"
          ? `Ask them to forward all calls to ${target || "<Cliste number>"}.`
          : "Ask for missed-call and busy divert to the Cliste number.",
      ],
    },
  ],
  virgin: (target, mode) => [
    {
      title: "Virgin Media fixed line",
      steps: [
        "Sign in to My Virgin Media or call business support.",
        mode === "forward_all"
          ? `Enable unconditional forwarding to ${target || "<Cliste number>"}.`
          : "Enable divert on no answer / busy to the Cliste number.",
      ],
    },
  ],
  other: (target, mode) => [
    {
      title: "Other carrier / PBX",
      steps: [
        "Configure call forwarding in the carrier portal or PBX admin.",
        mode === "forward_all"
          ? `Forward all inbound calls to ${target || "<Cliste number>"}.`
          : "Forward missed and busy calls to the Cliste number.",
        "If unsure, ring the carrier account manager and ask for divert to the Cliste DID.",
      ],
    },
  ],
};

export function landlineDivertInstructions(
  carrier: DivertCarrier | "",
  clisteNumber: string,
  mode: CallRoutingMode,
): DivertInstruction[] {
  const key = carrier && carrier in CARRIER_INSTRUCTIONS ? carrier : "other";
  return CARRIER_INSTRUCTIONS[key](clisteNumber.trim(), mode);
}
