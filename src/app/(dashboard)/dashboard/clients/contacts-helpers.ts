import {
  OUTCOME_LABELS,
  formatDurationLabel,
  normalizeCallOutcome,
} from "@/lib/call-history-types";

import {
  normalizeContactEmail,
} from "../action-inbox/action-inbox-helpers";
import {
  ACTION_CATEGORY_LABELS,
  ACTION_CATEGORY_SHORT,
  classifyActionCategory,
  type ActionCategory,
} from "../action-inbox/categories";

export type ContactCallEntry = {
  id: string;
  createdAt: string;
  dateLabel: string;
  dateTimeLabel: string;
  durationLabel: string;
  outcomeLabel: string;
  summary: string | null;
};

export type ContactFollowUp = {
  id: string;
  summary: string;
  createdAtLabel: string;
  category: ActionCategory;
  categoryShort: string;
  categoryTitle: string;
};

export type ContactListItem = {
  id: string;
  /** Canonical client row when this phone exists in CRM. */
  clientId: string | null;
  phoneRaw: string;
  phoneDisplay: string;
  displayName: string;
  /** From client profile — often null. */
  contactEmail: string | null;
  clientNotes: string | null;
  callCount: number;
  firstCallMs: number;
  lastCallMs: number;
  lastCallLabel: string;
  lastSummaryPreview: string | null;
  lastOutcomeLabel: string | null;
  openFollowUps: number;
  calls: ContactCallEntry[];
  openActions: ContactFollowUp[];
};

export type ContactsMetrics = {
  totalContacts: number;
  newContacts: number;
  repeatCallers: number;
  openFollowUps: number;
};

export type ContactFilter = "all" | "open_follow_up" | "repeat" | "new";

export const CONTACT_FILTER_OPTIONS: { value: ContactFilter; label: string }[] = [
  { value: "all", label: "All contacts" },
  { value: "open_follow_up", label: "Has open follow-up" },
  { value: "repeat", label: "Repeat callers" },
  { value: "new", label: "New contacts" },
];

const NEW_CONTACT_MS = 7 * 24 * 60 * 60 * 1000;

export function formatContactDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
  });
}

export function formatContactDateTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function summaryPreview(text: string | null | undefined, max = 120): string | null {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

export function contactSummary(item: ContactListItem): string | null {
  const latest = item.calls[0]?.summary;
  if (latest?.trim()) return latest.trim();
  return null;
}

export function isNewContact(item: ContactListItem, now = Date.now()): boolean {
  return item.firstCallMs > 0 && now - item.firstCallMs <= NEW_CONTACT_MS;
}

export function buildContactsMetrics(items: ContactListItem[]): ContactsMetrics {
  const now = Date.now();
  let newContacts = 0;
  let repeatCallers = 0;
  let openFollowUps = 0;

  for (const item of items) {
    if (item.callCount > 1) repeatCallers += 1;
    if (item.openFollowUps > 0) openFollowUps += 1;
    if (isNewContact(item, now)) newContacts += 1;
  }

  return {
    totalContacts: items.length,
    newContacts,
    repeatCallers,
    openFollowUps,
  };
}

export function hasContactEmail(
  item: Pick<ContactListItem, "contactEmail">,
): boolean {
  return normalizeContactEmail(item.contactEmail) !== null;
}

export function copyContactDetailsText(item: ContactListItem): string {
  const email = normalizeContactEmail(item.contactEmail);
  return [
    `Name: ${item.displayName}`,
    item.phoneDisplay ? `Phone: ${item.phoneDisplay}` : null,
    email ? `Email: ${email}` : "Email: Not on file",
    `${item.callCount} ${item.callCount === 1 ? "call" : "calls"} · Last call ${item.lastCallLabel}`,
    item.openFollowUps > 0
      ? `Open follow-ups: ${item.openFollowUps}`
      : "Open follow-ups: None",
    item.clientNotes ? `Notes: ${item.clientNotes}` : null,
    "",
    contactSummary(item) ?? "No call summary on file yet.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function matchesContactSearch(item: ContactListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qDigits = q.replace(/\D/g, "");
  const hay = [
    item.displayName,
    item.phoneDisplay,
    item.phoneRaw,
    item.contactEmail ?? "",
    item.clientNotes ?? "",
    item.lastSummaryPreview ?? "",
    item.lastOutcomeLabel ?? "",
  ]
    .join(" ")
    .toLowerCase();
  if (hay.includes(q)) return true;
  if (qDigits.length >= 4 && item.id.includes(qDigits)) return true;
  return false;
}

export function matchesContactFilter(
  item: ContactListItem,
  filter: ContactFilter,
  now = Date.now(),
): boolean {
  switch (filter) {
    case "open_follow_up":
      return item.openFollowUps > 0;
    case "repeat":
      return item.callCount > 1;
    case "new":
      return isNewContact(item, now);
    default:
      return true;
  }
}

export function initialsFor(displayName: string): string | null {
  if (displayName === "Unknown caller") return null;
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function buildFollowUp(row: {
  id: string;
  summary: string | null;
  created_at: string;
}): ContactFollowUp {
  const category = classifyActionCategory(row.summary);
  return {
    id: row.id,
    summary: row.summary?.trim() || "Follow-up",
    createdAtLabel: formatContactDateTimeLabel(row.created_at),
    category,
    categoryShort: ACTION_CATEGORY_SHORT[category],
    categoryTitle: ACTION_CATEGORY_LABELS[category],
  };
}

export function outcomeLabelFor(raw: string | null | undefined): string {
  return OUTCOME_LABELS[normalizeCallOutcome(String(raw ?? ""))];
}

export function durationLabelFor(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || seconds < 0) return "—";
  return formatDurationLabel(seconds);
}
