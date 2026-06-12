import { normalizeCallOutcome } from "@/lib/call-history-types";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { formatPhoneForDisplay } from "@/lib/phone-display";

/** Minutes since last call — pill shows "Live". */
const LIVE_THRESHOLD_MIN = 5;

/** Minutes since last call — pill shows "Nm ago" instead of a clock time. */
const RELATIVE_PILL_MAX_MIN = 59;

export type CaraLastCallSnapshot = {
  id: string;
  callerDisplay: string;
  createdAtIso: string;
  outcomeLabel: string;
  href: string;
};

export type CaraLastCallPill = {
  label: string;
  variant: "success" | "attention" | "neutral";
};

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString("en-IE", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function minutesAgo(iso: string, now: Date): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = now.getTime() - d.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 60_000);
}

/** Short outcome label (matches home activity badges). */
export function formatDashboardCallOutcomeLabel(outcome: string | null): string {
  switch (normalizeCallOutcome(String(outcome ?? ""))) {
    case "link_sent":
      return "Routed";
    case "callback_requested":
      return "Callback requested";
    case "action_created":
      return "Request captured";
    case "voicemail_or_no_speech":
      return "Voicemail";
    case "failed":
      return "Missed call";
    case "spam_or_abuse":
      return "Spam call";
    case "answered":
    default:
      return "Call answered";
  }
}

export function buildCaraLastCallSnapshot(
  row:
    | {
        id: string;
        created_at: string;
        caller_number: string | null;
        caller_name?: string | null;
        outcome: string | null;
      }
    | null
    | undefined,
): CaraLastCallSnapshot | null {
  if (!row?.id?.trim() || !row.created_at?.trim()) return null;
  const createdAtIso = row.created_at.trim();
  if (Number.isNaN(new Date(createdAtIso).getTime())) return null;

  const name = row.caller_name?.trim();
  const phoneRaw = row.caller_number?.trim();
  let callerDisplay = "Unknown caller";
  if (name) {
    callerDisplay = name;
  } else if (phoneRaw) {
    callerDisplay = formatPhoneForDisplay(phoneRaw);
  }

  const id = row.id.trim();
  return {
    id,
    callerDisplay,
    createdAtIso,
    outcomeLabel: formatDashboardCallOutcomeLabel(row.outcome),
    href: `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(id)}`,
  };
}

/** Line status pill from online state + how recently the last call ended. */
export function caraLineStatusPill(
  isOnline: boolean,
  lastCallAtIso: string | null,
  now: Date = new Date(),
): CaraLastCallPill {
  if (!isOnline) {
    return { label: "Offline", variant: "attention" };
  }

  if (!lastCallAtIso?.trim()) {
    return { label: "Online", variant: "success" };
  }

  const mins = minutesAgo(lastCallAtIso, now);
  if (mins === null) {
    return { label: "Online", variant: "success" };
  }

  if (mins < LIVE_THRESHOLD_MIN) {
    return { label: "Live", variant: "success" };
  }

  if (mins <= RELATIVE_PILL_MAX_MIN) {
    return {
      label: mins === 1 ? "1m ago" : `${mins}m ago`,
      variant: "success",
    };
  }

  const callDate = new Date(lastCallAtIso);
  if (callDate.toDateString() === now.toDateString()) {
    const t = formatShortTime(lastCallAtIso);
    return { label: t || "Today", variant: "success" };
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (callDate.toDateString() === yesterday.toDateString()) {
    return { label: "Yesterday", variant: "neutral" };
  }

  const dayLabel = callDate.toLocaleDateString("en-IE", {
    month: "short",
    day: "numeric",
  });
  return { label: dayLabel, variant: "neutral" };
}
