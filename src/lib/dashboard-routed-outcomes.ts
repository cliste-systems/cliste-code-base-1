import { normalizeCallOutcome, type CallOutcome } from "@/lib/call-history-types";

/** Call outcomes counted as “routed” on the Home dashboard metric. */
const ROUTED_OUTCOMES: readonly CallOutcome[] = [
  "link_sent",
  "callback_requested",
  "action_created",
];

export function isRoutedCallOutcome(outcome: string | null | undefined): boolean {
  return ROUTED_OUTCOMES.includes(normalizeCallOutcome(String(outcome ?? "")));
}
