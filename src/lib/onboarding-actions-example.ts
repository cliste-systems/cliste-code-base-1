import "server-only";

import { detectTradePack } from "@/app/(onboarding)/onboarding/knowledge/train-cara-trade-topics";
import type {
  ActionsStepExample,
  ActionsStepExampleInput,
} from "@/lib/onboarding-actions-example-shared";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { wrapUserContentForPrompt } from "@/lib/voice-greeting-security";

export type { ActionsStepExample, ActionsStepExampleInput } from "@/lib/onboarding-actions-example-shared";

const MAX_SETUP = 48;
const MAX_DOES = 140;

const BOOKING_NICHES = new Set(["hair_salon", "barber", "beauty", "hospitality"]);

const BOOKING_BLOB_PATTERN =
  /\b(salon|barber|hair|beauty|spa|nail|hairdress|fresha|book(?:ing)?|appointment)\b/i;

const VALID_DOES_START =
  /^(send|text|email|capture|add|notify|log|take|forward|share)\b/i;

const INVALID_DOES_START =
  /^(you can|you could|she can|cara can|answer|explain|tell|check|help with)\b/i;

const WEAK_DOES_PATTERN =
  /\b(send details about|send information about|details about|information about)\b/i;

const BOOKING_SETUP_PATTERN = /\b(book|booking|appointment|table|reservation)\b/i;

const BOOKING_DOES_PATTERN =
  /\b(booking link|book an? |appointment|reservation|table)\b/i;

function trimField(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function isBookingLedBusiness(input: ActionsStepExampleInput): boolean {
  const pack = detectTradePack(String(input.businessType ?? "").trim());
  const niche = String(input.niche ?? "").trim();
  if (pack === "salon") return true;
  if (BOOKING_NICHES.has(niche)) return true;

  const blob = [
    input.businessType,
    input.niche,
    input.servicesOffered,
    input.rawBusinessDescription,
    input.knowledgeSummary,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  return BOOKING_BLOB_PATTERN.test(blob);
}

function normalizeDoesPhrase(raw: string): string {
  let phrase = raw.trim().replace(/\.+$/, "");
  phrase = phrase.replace(/^(you can|you could|she can|cara can)\s+/i, "");
  if (!phrase) return "";
  return phrase.charAt(0).toLowerCase() + phrase.slice(1);
}

function isValidDoesPhrase(does: string): boolean {
  if (!does || does.length < 12) return false;
  if (INVALID_DOES_START.test(does)) return false;
  if (WEAK_DOES_PATTERN.test(does)) return false;
  return VALID_DOES_START.test(does);
}

function isQualityExample(
  example: ActionsStepExample,
  input: ActionsStepExampleInput,
): boolean {
  if (!isValidDoesPhrase(example.does)) return false;
  if (/\binfo\b/i.test(example.setup)) return false;

  if (isBookingLedBusiness(input)) {
    return (
      BOOKING_SETUP_PATTERN.test(example.setup) &&
      BOOKING_DOES_PATTERN.test(example.does)
    );
  }

  return true;
}

function cleanExample(
  value: unknown,
  input: ActionsStepExampleInput,
): ActionsStepExample | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const setup = trimField(String(record.setup ?? ""), MAX_SETUP);
  const does = normalizeDoesPhrase(trimField(String(record.does ?? ""), MAX_DOES));
  if (!setup || !does) return null;

  const example = { setup, does };
  if (!isQualityExample(example, input)) return null;
  return example;
}

function buildBookingExample(): ActionsStepExample {
  return {
    setup: "Book online",
    does: "send your booking link when callers want to book an appointment",
  };
}

export function buildHeuristicActionsStepExample(
  input: ActionsStepExampleInput,
): ActionsStepExample {
  if (isBookingLedBusiness(input)) {
    return buildBookingExample();
  }

  const pack = detectTradePack(String(input.businessType ?? "").trim());
  const niche = String(input.niche ?? "").trim();

  if (pack === "trades" || niche === "home_services") {
    return {
      setup: "Quote request",
      does: "capture the job details in your Action Inbox when callers need a price",
    };
  }

  if (niche === "retail") {
    return {
      setup: "Product catalogue",
      does: "text your catalogue link when callers want to browse what you sell",
    };
  }

  return {
    setup: "Book online",
    does: "send your enquiry link when callers want to get in touch or get started",
  };
}

function parseActionsStepExampleJson(
  raw: string,
  input: ActionsStepExampleInput,
): ActionsStepExample | null {
  try {
    const trimmed = raw.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;

    const json = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    const direct = cleanExample(json, input);
    if (direct) return direct;

    if (Array.isArray(json.examples) && json.examples.length > 0) {
      return cleanExample(json.examples[0], input);
    }

    return null;
  } catch {
    return null;
  }
}

export async function generateActionsStepExample(
  input: ActionsStepExampleInput,
): Promise<ActionsStepExample> {
  const heuristic = buildHeuristicActionsStepExample(input);

  if (isBookingLedBusiness(input)) {
    return heuristic;
  }

  const businessName = String(input.businessName ?? "").trim() || "the business";
  const businessType = String(input.businessType ?? "").trim();
  const niche = String(input.niche ?? "").trim();
  const description = String(input.rawBusinessDescription ?? "").trim();
  const services = String(input.servicesOffered ?? "").trim();
  const summary = String(input.knowledgeSummary ?? "").trim();

  if (description.length < 12 && services.length < 8 && summary.length < 12) {
    return heuristic;
  }

  const contextLines = [
    businessType ? `Business type: ${businessType}` : null,
    niche ? `Niche: ${niche}` : null,
    services ? `Services offered: ${services}` : null,
    summary ? `Knowledge summary: ${summary.slice(0, 800)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0.2,
      maxTokens: 160,
      messages: [
        {
          role: "system",
          content: `You write ONE short Routing example for Cara, an AI phone assistant.
Return JSON only: {"setup":"...","does":"..."}

setup: short Routing action name (2–4 words), e.g. "Book online", "Quote request", "Price list"

does: completes "You could set up {setup} to {does}."
- MUST start with: send, text, email, capture, add, notify, or take
- Describe a concrete handoff (booking link, file, team email, Action Inbox)
- Under 100 characters; plain English

Good: "send your booking link when callers want to book a table"
Good: "capture the job details in your Action Inbox when callers need a quote"
Bad: "send details about hair cutting services"
Bad: "send information about your services"

Cara only sends outbound texts or emails. No WhatsApp.`,
        },
        {
          role: "user",
          content: `Business name: ${businessName}
${contextLines ? `${contextLines}\n` : ""}${
            description
              ? `Owner description:\n${wrapUserContentForPrompt("description", description.slice(0, 2000))}`
              : ""
          }`,
        },
      ],
    });

    const parsed = parseActionsStepExampleJson(raw, input);
    if (parsed) return parsed;
  } catch (err) {
    console.warn("[onboarding-actions-example] openrouter_failed", err);
  }

  return heuristic;
}
