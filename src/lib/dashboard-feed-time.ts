import { addDays, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { formatE164ForDisplay } from "@/lib/call-history-types";
import {
  CALLER_DATA_ERASED_LABEL,
  isCallerDataErased,
  isErasedCallerNumber,
} from "@/lib/caller-data-erasure";

const DUBLIN = "Europe/Dublin";

/**
 * Home feed timestamps: time-only for today (Dublin), otherwise include the date
 * so an old open ticket does not look like it happened this morning.
 */
export function formatDashboardFeedTime(
  iso: string,
  now: Date = new Date(),
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const zonedNow = toZonedTime(now, DUBLIN);
  const zonedEvent = toZonedTime(d, DUBLIN);
  const startToday = startOfDay(zonedNow);
  const startEventDay = startOfDay(zonedEvent);

  const timeLabel = d
    .toLocaleTimeString("en-IE", {
      timeZone: DUBLIN,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (startEventDay.getTime() === startToday.getTime()) {
    return timeLabel;
  }

  const startYesterday = addDays(startToday, -1);
  if (startEventDay.getTime() === startYesterday.getTime()) {
    return `Yesterday, ${timeLabel}`;
  }

  const dateLabel = d.toLocaleDateString("en-IE", {
    timeZone: DUBLIN,
    day: "numeric",
    month: "short",
  });
  return `${dateLabel}, ${timeLabel}`;
}

/** Relative timestamps for the home live activity feed. */
export function formatDashboardFeedRelativeTime(
  iso: string,
  now: Date = new Date(),
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? "1 min ago" : `${minutes} mins ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return formatDashboardFeedTime(iso, now);
}

export function ticketCallerLabel(input: {
  caller_name?: string | null;
  caller_number?: string | null;
  caller_data_erased_at?: string | null;
}): string {
  if (
    isCallerDataErased({ callerDataErasedAt: input.caller_data_erased_at }) ||
    isErasedCallerNumber(input.caller_number)
  ) {
    return CALLER_DATA_ERASED_LABEL;
  }
  const first = callerFirstName(input);
  if (first) return first;
  const phone = input.caller_number?.trim();
  if (phone) return formatE164ForDisplay(phone) || phone;
  return "Caller";
}

/** Activity page — phone number only, never caller name. */
export function activityFeedCallerLabel(input: {
  caller_number?: string | null;
  caller_data_erased_at?: string | null;
}): string {
  if (
    isCallerDataErased({ callerDataErasedAt: input.caller_data_erased_at }) ||
    isErasedCallerNumber(input.caller_number)
  ) {
    return CALLER_DATA_ERASED_LABEL;
  }
  const phone = input.caller_number?.trim();
  if (phone) return formatE164ForDisplay(phone) || phone;
  return "Unknown caller";
}

/** First name only — Cara asks for first name on retail calls. */
export function callerFirstName(input: {
  caller_name?: string | null;
}): string | null {
  const name = input.caller_name?.trim();
  if (!name) return null;
  return name.split(/\s+/)[0] ?? name;
}

/** Home Live activity row title only (prefer callerLiveActivityLabel for name + number). */
export function liveActivityListTitle(input: {
  caller_name?: string | null;
  caller_number?: string | null;
  caller_data_erased_at?: string | null;
}): string {
  const label = callerLiveActivityLabel(input);
  if (label.subtitle && label.title !== label.subtitle) {
    return `${label.title} ${label.subtitle}`;
  }
  return label.title;
}

/** Incoming call row on home / calls — number only when no name yet. */
export function incomingCallListLabel(callerNumber: string | null | undefined): {
  title: string;
  subtitle?: string;
} {
  const phone = String(callerNumber ?? "").trim();
  if (!phone) return { title: "Incoming call" };
  const formatted = formatE164ForDisplay(phone) || phone;
  return { title: formatted };
}

/** @deprecated Use incomingCallListLabel */
export function incomingCallListTitle(callerNumber: string | null | undefined): string {
  return incomingCallListLabel(callerNumber).title;
}

/** Home Live activity: first name on top, phone below. */
export function callerLiveActivityLabel(input: {
  caller_name?: string | null;
  caller_number?: string | null;
  caller_data_erased_at?: string | null;
}): { title: string; subtitle?: string } {
  if (
    isCallerDataErased({ callerDataErasedAt: input.caller_data_erased_at }) ||
    isErasedCallerNumber(input.caller_number)
  ) {
    return { title: CALLER_DATA_ERASED_LABEL };
  }
  const first = callerFirstName(input);
  const phoneRaw = input.caller_number?.trim();
  const phone = phoneRaw ? formatE164ForDisplay(phoneRaw) || phoneRaw : null;
  if (first && phone) return { title: first, subtitle: phone };
  if (first) return { title: first };
  if (phone) return { title: phone };
  return { title: "Unknown caller" };
}
