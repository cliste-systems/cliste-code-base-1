import { classifyActionCategory } from "@/app/(dashboard)/dashboard/action-inbox/categories";
import { normalizeCallOutcome } from "@/lib/call-history-types";

export type AnalyticsSegment = {
  id: string;
  label: string;
  value: number;
  percent: number;
  shade: string;
};

export type HomeUsageSnapshot = {
  minutesUsed: number;
  includedMinutes: number;
  remainingMinutes: number;
  progressPct: number;
};

const REQUEST_TYPE_SHADES = [
  "#0b1220",
  "#475569",
  "#94a3b8",
  "#cbd5e1",
] as const;

const CALL_OUTCOME_SHADES = [
  "#0b1220",
  "#475569",
  "#94a3b8",
  "#cbd5e1",
] as const;

function withPercents(
  items: { id: string; label: string; value: number }[],
  shades: readonly string[],
): AnalyticsSegment[] {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return items.map((item, index) => ({
      ...item,
      percent: 0,
      shade: shades[index] ?? shades[shades.length - 1]!,
    }));
  }

  return items.map((item, index) => ({
    ...item,
    percent: Math.round((item.value / total) * 100),
    shade: shades[index] ?? shades[shades.length - 1]!,
  }));
}

export function buildHomeRequestTypeSegments(
  summaries: (string | null | undefined)[],
): AnalyticsSegment[] {
  let generalEnquiries = 0;
  let callbacks = 0;
  let pricing = 0;
  let productEnquiries = 0;

  for (const summary of summaries) {
    const category = classifyActionCategory(summary);
    switch (category) {
      case "quote":
        pricing += 1;
        break;
      case "callback":
        callbacks += 1;
        break;
      case "lead":
        productEnquiries += 1;
        break;
      default:
        generalEnquiries += 1;
        break;
    }
  }

  return withPercents(
    [
      { id: "general", label: "General enquiries", value: generalEnquiries },
      { id: "callbacks", label: "Callbacks", value: callbacks },
      { id: "pricing", label: "Pricing", value: pricing },
      { id: "product", label: "Product enquiries", value: productEnquiries },
    ],
    REQUEST_TYPE_SHADES,
  );
}

export function buildHomeCallOutcomeSegments(
  outcomes: (string | null | undefined)[],
): AnalyticsSegment[] {
  let answeredByCara = 0;
  let informationProvided = 0;
  let followUpCreated = 0;
  let other = 0;

  for (const raw of outcomes) {
    switch (normalizeCallOutcome(String(raw ?? ""))) {
      case "answered":
        answeredByCara += 1;
        break;
      case "link_sent":
        informationProvided += 1;
        break;
      case "action_created":
      case "callback_requested":
        followUpCreated += 1;
        break;
      default:
        other += 1;
        break;
    }
  }

  return withPercents(
    [
      { id: "answered", label: "Answered by Cara", value: answeredByCara },
      {
        id: "information",
        label: "Information provided",
        value: informationProvided,
      },
      {
        id: "follow-up",
        label: "Follow-up created",
        value: followUpCreated,
      },
      { id: "other", label: "Other", value: other },
    ],
    CALL_OUTCOME_SHADES,
  );
}

export function buildHomeUsageSnapshot(input: {
  minutesUsed: number;
  includedMinutes: number;
}): HomeUsageSnapshot {
  const includedMinutes = Math.max(0, input.includedMinutes);
  const minutesUsed = Math.max(0, Math.round(input.minutesUsed));
  const remainingMinutes = Math.max(0, includedMinutes - minutesUsed);
  const progressPct =
    includedMinutes > 0
      ? Math.min(100, Math.round((minutesUsed / includedMinutes) * 100))
      : 0;

  return {
    minutesUsed,
    includedMinutes,
    remainingMinutes,
    progressPct,
  };
}

export function analyticsSegmentsTotal(segments: AnalyticsSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.value, 0);
}
