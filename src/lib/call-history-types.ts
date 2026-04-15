export type CallOutcome =
  | "booked"
  | "appointment_set"
  | "link_sent"
  | "message_taken"
  | "action_required"
  | "hung_up"
  | "general_inquiry";

export type CallHistoryRow = {
  id: string;
  dateTimeLabel: string;
  /** Raw value from the database (E.164 or other). */
  callerId: string;
  /** Display-friendly phone string. */
  callerDisplay: string;
  durationLabel: string;
  outcome: CallOutcome;
  /** Verbatim STT + assistant lines as captured on the call. */
  transcriptVerbatim: string;
  /** Corrected for obvious STT errors using the menu; null for older rows. */
  transcriptReview: string | null;
  /** Short AI summary for the salon owner; null for older rows. */
  aiSummary: string | null;
};

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  booked: "Booked",
  appointment_set: "Appointment Set",
  link_sent: "Link Sent",
  message_taken: "Message Taken",
  action_required: "Action Required",
  hung_up: "Hung Up",
  general_inquiry: "General Inquiry",
};

export function normalizeCallOutcome(raw: string): CallOutcome {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "_");
  const hay = raw.toLowerCase();

  if (/\bbooked\b/.test(hay) || s === "booked") return "booked";
  if (
    hay.includes("appointment") &&
    (hay.includes("set") ||
      hay.includes("scheduled") ||
      hay.includes("booked"))
  )
    return "appointment_set";
  if (s === "appointment_set" || s === "appointmentset")
    return "appointment_set";

  if (hay.includes("link") && hay.includes("sent")) return "link_sent";
  if (s === "link_sent" || s === "linksent") return "link_sent";

  if (hay.includes("message") && hay.includes("taken")) return "message_taken";
  if (s === "message_taken" || s === "messagetaken") return "message_taken";

  if (hay.includes("action") && hay.includes("required"))
    return "action_required";
  if (s === "action_required" || s === "actionrequired")
    return "action_required";

  if (hay.includes("general") && hay.includes("inquiry"))
    return "general_inquiry";
  if (s === "general_inquiry" || s === "generalinquiry")
    return "general_inquiry";

  if (
    hay.includes("hung") ||
    hay.includes("disconnect") ||
    s === "hung_up" ||
    s === "hungup"
  )
    return "hung_up";

  if (hay.includes("message")) return "message_taken";

  return "general_inquiry";
}

/** Pretty-print common E.164 values; otherwise groups digits for readability. */
export function formatE164ForDisplay(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const digits = t.replace(/\D/g, "");
  if (digits.length < 10) return t;

  if (digits.startsWith("353") && digits.length === 12) {
    const r = digits.slice(3);
    return `+353 ${r.slice(0, 2)} ${r.slice(2, 5)} ${r.slice(5)}`;
  }

  if (digits.startsWith("1") && digits.length === 11) {
    const r = digits.slice(1);
    return `+1 (${r.slice(0, 3)}) ${r.slice(3, 6)}-${r.slice(6)}`;
  }

  const chunks: string[] = [];
  let rest = digits;
  const ccLen = rest.length > 11 ? 3 : rest.length > 10 ? 2 : 1;
  chunks.push(rest.slice(0, ccLen));
  rest = rest.slice(ccLen);
  while (rest.length) {
    const take = rest.length > 4 ? 3 : rest.length;
    chunks.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  return `+${chunks.join(" ")}`;
}

export function formatDurationLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

export function formatCallDateTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function mapCallLogToRow(log: {
  id: string;
  caller_number: string;
  duration_seconds: number;
  outcome: string;
  transcript: string | null;
  transcript_review: string | null;
  ai_summary: string | null;
  created_at: string;
}): CallHistoryRow {
  const callerId = log.caller_number.trim();
  const verbatim = log.transcript?.trim() || "";
  return {
    id: log.id,
    dateTimeLabel: formatCallDateTimeLabel(log.created_at),
    callerId,
    callerDisplay: formatE164ForDisplay(callerId),
    durationLabel: formatDurationLabel(log.duration_seconds),
    outcome: normalizeCallOutcome(log.outcome),
    transcriptVerbatim: verbatim || "No transcript on file.",
    transcriptReview: log.transcript_review?.trim() ?? null,
    aiSummary: log.ai_summary?.trim() ?? null,
  };
}
