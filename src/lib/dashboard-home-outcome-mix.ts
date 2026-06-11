import { normalizeCallOutcome, type CallOutcome } from "@/lib/call-history-types";

export type OutcomeMixRow = {
  id: string;
  label: string;
  count: number;
};

const HOME_OUTCOME_BUCKETS: {
  id: string;
  label: string;
  outcomes: CallOutcome[];
}[] = [
  { id: "answered", label: "Answered", outcomes: ["answered"] },
  { id: "routed", label: "Routed", outcomes: ["link_sent"] },
  {
    id: "request",
    label: "Request captured",
    outcomes: ["action_created"],
  },
  {
    id: "callback",
    label: "Callback requested",
    outcomes: ["callback_requested"],
  },
  {
    id: "failed",
    label: "Failed",
    outcomes: ["failed", "voicemail_or_no_speech", "spam_or_abuse"],
  },
];

export function buildHomeOutcomeMix(
  outcomes: (string | null | undefined)[],
): OutcomeMixRow[] {
  const counts = new Map<string, number>();
  for (const bucket of HOME_OUTCOME_BUCKETS) {
    counts.set(bucket.id, 0);
  }

  for (const raw of outcomes) {
    const normalized = normalizeCallOutcome(String(raw ?? ""));
    const bucket = HOME_OUTCOME_BUCKETS.find((b) =>
      b.outcomes.includes(normalized),
    );
    if (bucket) {
      counts.set(bucket.id, (counts.get(bucket.id) ?? 0) + 1);
    }
  }

  return HOME_OUTCOME_BUCKETS.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    count: counts.get(bucket.id) ?? 0,
  }));
}
