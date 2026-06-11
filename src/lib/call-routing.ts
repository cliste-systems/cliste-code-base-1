/**
 * How a business connects their calls to Cara.
 *
 * Two real-world models, plus a conditional variant:
 *  - cliste_number  → they advertise the Cliste DID; Cara answers every call.
 *                     Cara can safely transfer to a human (fallback_number).
 *  - forward_all    → they keep their published number and forward ALL calls to
 *                     the Cliste DID. Transferring back would loop, so no human
 *                     transfer is offered.
 *  - forward_missed → their own phone rings first; only missed/busy calls divert
 *                     to the Cliste DID (carrier conditional forwarding).
 *
 * Source of truth: organizations.call_routing_mode (migration 052).
 */
export const CALL_ROUTING_MODES = [
  "cliste_number",
  "forward_all",
  "forward_missed",
] as const;

export type CallRoutingMode = (typeof CALL_ROUTING_MODES)[number];

export const DEFAULT_CALL_ROUTING_MODE: CallRoutingMode = "cliste_number";

export function isCallRoutingMode(value: unknown): value is CallRoutingMode {
  return (
    typeof value === "string" &&
    (CALL_ROUTING_MODES as readonly string[]).includes(value)
  );
}

export function parseCallRoutingMode(raw: unknown): CallRoutingMode {
  return isCallRoutingMode(raw) ? raw : DEFAULT_CALL_ROUTING_MODE;
}

/** Only "use our number" can transfer to a human without creating a forward loop. */
export function callRoutingAllowsHumanTransfer(mode: CallRoutingMode): boolean {
  return mode === "cliste_number";
}

/** Did the business keep their own published number (i.e. set up forwarding)? */
export function callRoutingUsesForwarding(mode: CallRoutingMode): boolean {
  return mode === "forward_all" || mode === "forward_missed";
}

export type CallRoutingModeMeta = {
  id: CallRoutingMode;
  title: string;
  /** One-line summary for choice cards. */
  tagline: string;
  /** Longer explanation for the selected state. */
  description: string;
  /** Whether human transfer is available in this mode. */
  allowsTransfer: boolean;
};

export const CALL_ROUTING_MODE_META: Record<CallRoutingMode, CallRoutingModeMeta> =
  {
    cliste_number: {
      id: "cliste_number",
      title: "Use your new Cliste number",
      tagline: "Cara answers your new Irish number directly.",
      description:
        "Advertise your Cliste number as your main line. Cara picks up every call and can put callers through to you when needed.",
      allowsTransfer: true,
    },
    forward_all: {
      id: "forward_all",
      title: "Keep your number — forward every call",
      tagline: "Callers keep dialling your number; it rings Cara.",
      description:
        "Keep your existing published number and divert all calls to Cara. Your phone stays silent — Cara handles everything.",
      allowsTransfer: false,
    },
    forward_missed: {
      id: "forward_missed",
      title: "Keep your number — Cara catches missed calls",
      tagline: "Your team rings first; Cara catches the rest.",
      description:
        "Your own phone rings first. Only calls you miss or can't take divert to Cara, so nothing goes unanswered.",
      allowsTransfer: false,
    },
  };

export type ForwardingKind = "all" | "missed" | "busy";

export type ForwardingCode = {
  kind: ForwardingKind;
  label: string;
  /** What dialling this does, in plain words. */
  hint: string;
  /** MMI/USSD activation string with the target number filled in. */
  activate: string;
  /** Disable string. */
  cancel: string;
};

const DIGITS_ONLY = /[^\d+]/g;

/** Normalise an E.164-ish number for use inside a dial code. */
export function normalizeForwardTarget(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  // Keep a leading + and digits only; carriers accept national or +intl format.
  const cleaned = trimmed.replace(DIGITS_ONLY, "");
  return cleaned;
}

/**
 * Standard GSM call-forwarding (divert) codes. Confirmed against Vodafone
 * Ireland and used by Eir, Three and Irish MVNOs. Mobiles only — landline
 * carriers configure diverts via their own portal.
 *
 * @param target  The Cliste DID to forward to (E.164).
 * @param ringSeconds  Ring time before a missed call diverts (multiple of 5, 5–30).
 */
export function buildForwardingCodes(
  target: string,
  ringSeconds = 20,
): ForwardingCode[] {
  const number = normalizeForwardTarget(target);
  const secs = clampRingSeconds(ringSeconds);
  const dest = number || "<your Cliste number>";

  return [
    {
      kind: "all",
      label: "Forward every call",
      hint: "Your phone won't ring — all calls go straight to Cara.",
      activate: `**21*${dest}#`,
      cancel: "##21#",
    },
    {
      kind: "missed",
      label: "Forward missed calls",
      hint: `Rings your phone for ~${secs}s, then diverts to Cara.`,
      activate: `**61*${dest}*${secs}#`,
      cancel: "##61#",
    },
    {
      kind: "busy",
      label: "Forward when busy",
      hint: "Diverts to Cara when your line is engaged.",
      activate: `**67*${dest}#`,
      cancel: "##67#",
    },
  ];
}

/** Cancel-all divert code (turns off every forwarding rule). */
export const CANCEL_ALL_FORWARDING_CODE = "##002#";

/** Which forwarding codes matter for a given mode. */
export function forwardingCodesForMode(
  mode: CallRoutingMode,
  target: string,
  ringSeconds = 20,
): ForwardingCode[] {
  const all = buildForwardingCodes(target, ringSeconds);
  if (mode === "forward_all") return all.filter((c) => c.kind === "all");
  if (mode === "forward_missed")
    return all.filter((c) => c.kind === "missed" || c.kind === "busy");
  return [];
}

function clampRingSeconds(value: number): number {
  if (!Number.isFinite(value)) return 20;
  const rounded = Math.round(value / 5) * 5;
  return Math.min(Math.max(rounded, 5), 30);
}
