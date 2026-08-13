import { normalizeCallOutcome } from "@/lib/call-history-types";

type DeliveryChannel = "sms" | "email" | "whatsapp";

function inferDeliveryChannel(summary: string): DeliveryChannel | null {
  const s = summary.toLowerCase();
  if (/\bwhatsapp\b/.test(s)) return "whatsapp";
  if (/\b(e-?mail)\b/.test(s)) return "email";
  if (
    /\b(sms|text message|texted)\b/.test(s) ||
    /\b(via|by)\s+text\b/.test(s) ||
    /\b(via|by)\s+sms\b/.test(s)
  ) {
    return "sms";
  }
  return null;
}

function inferContentKind(summary: string): "pdf" | "link" | "file" | null {
  const s = summary.toLowerCase();
  if (/\bpdf\b/.test(s)) return "pdf";
  if (/\b(link|url|booking link)\b/.test(s)) return "link";
  if (/\b(file|document|brochure|menu|price list)\b/.test(s)) return "file";
  return null;
}

function channelPhrase(channel: DeliveryChannel): string {
  switch (channel) {
    case "sms":
      return "SMS";
    case "email":
      return "email";
    case "whatsapp":
      return "WhatsApp";
  }
}

function sentViaLabel(content: string, channel: DeliveryChannel): string {
  return `${content} sent via ${channelPhrase(channel)}`;
}

/** What Cara did on the call — not what the caller asked about. */
export function formatLiveActivityCallAction(
  outcome: string | null | undefined,
  aiSummary: string | null | undefined,
): string {
  const normalized = normalizeCallOutcome(String(outcome ?? ""));
  const summary = String(aiSummary ?? "").trim();
  const channel = summary ? inferDeliveryChannel(summary) : null;
  const content = summary ? inferContentKind(summary) : null;

  if (normalized === "link_sent" || (normalized === "action_created" && channel)) {
    if (content === "pdf" && channel) {
      return sentViaLabel("PDF", channel);
    }
    if (content === "file" && channel) {
      return sentViaLabel("File", channel);
    }
    if (channel) {
      return sentViaLabel("Link", channel);
    }
    if (normalized === "link_sent") return "Link sent";
  }

  switch (normalized) {
    case "answered":
      return "Phone answered";
    case "callback_requested":
      return "Callback requested";
    case "action_created":
      return "Follow-up created";
    case "failed":
      return "Missed call";
    case "voicemail_or_no_speech":
      return "Voicemail";
    case "spam_or_abuse":
      return "Spam call";
    default:
      return "Phone answered";
  }
}

/** Action Inbox items in the live feed — never the ticket summary text. */
export function formatLiveActivityTicketAction(): string {
  return "Enquiry captured";
}
