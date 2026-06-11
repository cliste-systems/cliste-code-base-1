import "server-only";

import { CARA_TRAINING_CAPTURE_LINE } from "@/lib/cara-starter-notes";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { wrapUserContentForPrompt } from "@/lib/voice-greeting-security";

const MAX_DESCRIPTION = 8000;
const MAX_SUMMARY = 4000;
const MAX_EXTRACTED_FIELD = 600;

type GenerateInput = {
  businessName: string;
  businessType?: string | null;
  description: string;
};

/** Structured facts pulled from the owner's description to pre-fill the details step. */
export type CaraKnowledgeExtraction = {
  openingHours?: string;
  serviceArea?: string;
  servicesOffered?: string;
  emergencyCallouts?: string;
  refinedBusinessType?: string;
  extraNotes?: string;
};

type GenerateResult =
  | {
      ok: true;
      summary: string;
      source: "openrouter" | "structured";
      extracted: CaraKnowledgeExtraction;
    }
  | { ok: false; message: string };

function trimDescription(description: string): string {
  return description.trim().slice(0, MAX_DESCRIPTION);
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? text).trim();
}

function extractTopics(description: string): string[] {
  const chunks = description
    .split(/[\n,;]+/)
    .map((part) => part.replace(/^[\s•\-–—]+/, "").trim())
    .filter((part) => part.length > 2 && part.length < 120);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of chunks) {
    const key = chunk.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(chunk);
  }
  return out.slice(0, 8);
}

/** Deterministic notes when OpenRouter is unavailable. */
export function buildStructuredCaraNotes(input: GenerateInput): string {
  const description = trimDescription(input.description);
  if (!description) return "";

  const businessName = input.businessName.trim() || "This business";
  const topics = extractTopics(description);
  const topicLine =
    topics.length > 0
      ? `Callers usually ask about ${topics.join(", ").replace(/, ([^,]*)$/, ", and $1")}.`
      : firstSentence(description);

  const typeHint = input.businessType?.trim()
    ? `I'm training to answer calls for ${businessName}, a ${input.businessType.trim()} business.`
    : `I'm training to answer calls for ${businessName}.`;

  const context = firstSentence(description);
  return [typeHint, topicLine || context, CARA_TRAINING_CAPTURE_LINE]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SUMMARY);
}

type ParsedSummary = {
  summary: string;
  extracted: CaraKnowledgeExtraction;
};

function cleanExtractedField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_EXTRACTED_FIELD);
}

function parseSummaryJson(raw: string): ParsedSummary | null {
  try {
    const trimmed = raw.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    const json =
      start >= 0 && end > start
        ? (JSON.parse(trimmed.slice(start, end + 1)) as {
            summary?: string;
            openingHours?: unknown;
            serviceArea?: unknown;
            servicesOffered?: unknown;
            emergencyCallouts?: unknown;
            refinedBusinessType?: unknown;
            extraNotes?: unknown;
          })
        : null;
    const summary = json?.summary?.trim();
    if (!summary || summary.length < 40) return null;

    const extracted: CaraKnowledgeExtraction = {};
    const openingHours = cleanExtractedField(json?.openingHours);
    if (openingHours) extracted.openingHours = openingHours;
    const serviceArea = cleanExtractedField(json?.serviceArea);
    if (serviceArea) extracted.serviceArea = serviceArea;
    const servicesOffered = cleanExtractedField(json?.servicesOffered);
    if (servicesOffered) extracted.servicesOffered = servicesOffered;
    const emergencyCallouts = cleanExtractedField(json?.emergencyCallouts);
    if (emergencyCallouts) extracted.emergencyCallouts = emergencyCallouts;
    const refinedBusinessType = cleanExtractedField(json?.refinedBusinessType);
    if (refinedBusinessType) extracted.refinedBusinessType = refinedBusinessType;
    const extraNotes = cleanExtractedField(json?.extraNotes);
    if (extraNotes) extracted.extraNotes = extraNotes;

    return { summary: summary.slice(0, MAX_SUMMARY), extracted };
  } catch {
    return null;
  }
}

export async function generateCaraBusinessNotes(
  input: GenerateInput,
): Promise<GenerateResult> {
  const description = trimDescription(input.description);
  if (description.length < 40) {
    return {
      ok: false,
      message: "Add a bit more detail so Cara has enough to work with.",
    };
  }

  const businessName = input.businessName.trim() || "the business";

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0.2,
      maxTokens: 600,
      messages: [
        {
          role: "system",
          content: `You write Cara's TRAINING NOTES for phone calls at a local business — first person only, as if Cara is planning what she will do. Extract structured facts from the owner's description.
Return JSON only:
{"summary":"...","openingHours":"...","serviceArea":"...","servicesOffered":"...","emergencyCallouts":"...","refinedBusinessType":"...","extraNotes":"..."}
Rules for "summary":
- 2-4 sentences, plain English, no bullet points, FIRST PERSON (I / we for the business)
- Start with training for the business name and trade (e.g. "I'm training to answer calls for …")
- Say what callers ask about and what I should collect or do (use "I should…", never "Cara should")
- Do not mention AI, models, prompts, or configuration
- Do not invent prices, guarantees, or policies not in the description
Rules for structured fields — ONLY include a key when clearly stated. Omit otherwise. Never guess.
- "openingHours": short text (e.g. "Mon-Fri 9am-6pm")
- "serviceArea": towns/regions/radius covered
- "servicesOffered": list of main services or job types
- "emergencyCallouts": yes/no and brief detail if mentioned
- "refinedBusinessType": short label (e.g. "Plumber") — infer from description if not given; use profile type as hint only
- "extraNotes": parking, payment, location hints, anything else factual from the description`,
        },
        {
          role: "user",
          content: `Business name: ${businessName}
${input.businessType?.trim() ? `Business type: ${input.businessType.trim()}\n` : ""}
Owner description:
${wrapUserContentForPrompt("description", description)}`,
        },
      ],
    });

    const parsed = parseSummaryJson(raw);
    if (parsed) {
      return {
        ok: true,
        summary: parsed.summary,
        source: "openrouter",
        extracted: parsed.extracted,
      };
    }
  } catch (err) {
    console.warn("[business-knowledge-summary] openrouter_failed", err);
  }

  const fallback = buildStructuredCaraNotes(input);
  if (!fallback) {
    return { ok: false, message: "Could not generate notes. Try adding more detail." };
  }

  return { ok: true, summary: fallback, source: "structured", extracted: {} };
}

export { MAX_DESCRIPTION, MAX_SUMMARY };
