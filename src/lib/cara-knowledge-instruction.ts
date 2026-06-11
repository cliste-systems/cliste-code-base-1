import "server-only";

import { tryParseTemporaryUnavailabilityRule } from "@/lib/cara-instruction-heuristics";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { wrapUserContentForPrompt } from "@/lib/voice-greeting-security";

export type CaraInstructionContext = {
  businessName: string;
  businessType: string;
  openingHours: string;
  serviceArea: string;
  servicesOffered: string;
  servicesNotOffered: string;
  detailsToCollect: string;
  rules: string[];
  anythingElse: string;
  faqQuestions: string[];
};

/** Structured edit Cara wants to make to the knowledge base. */
export type CaraInstructionPatch = {
  openingHours: string | null;
  serviceArea: string | null;
  servicesOffered: string | null;
  servicesNotOffered: string | null;
  detailsToCollect: string | null;
  rulesAdd: string[];
  rulesRemove: string[];
  faqsAdd: { question: string; answer: string }[];
  anythingElseAppend: string | null;
  confirmation: string;
  clarification: string;
};

export type InterpretInstructionResult =
  | { ok: true; patch: CaraInstructionPatch }
  | { ok: false; message: string };

const EMPTY_PATCH: CaraInstructionPatch = {
  openingHours: null,
  serviceArea: null,
  servicesOffered: null,
  servicesNotOffered: null,
  detailsToCollect: null,
  rulesAdd: [],
  rulesRemove: [],
  faqsAdd: [],
  anythingElseAppend: null,
  confirmation: "",
  clarification: "",
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strOrNull(value: unknown): string | null {
  const s = str(value);
  return s ? s : null;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => str(v)).filter(Boolean);
}

function faqArray(value: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { question: string; answer: string }[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const question = str(rec.question);
    const answer = str(rec.answer);
    if (question) out.push({ question, answer });
  }
  return out;
}

function parsePatchJson(raw: string): CaraInstructionPatch | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const json = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    return {
      openingHours: strOrNull(json.openingHours),
      serviceArea: strOrNull(json.serviceArea),
      servicesOffered: strOrNull(json.servicesOffered),
      servicesNotOffered: strOrNull(json.servicesNotOffered),
      detailsToCollect: strOrNull(json.detailsToCollect),
      rulesAdd: strArray(json.rulesAdd),
      rulesRemove: strArray(json.rulesRemove),
      faqsAdd: faqArray(json.faqsAdd),
      anythingElseAppend: strOrNull(json.anythingElseAppend ?? json.notesAppend),
      confirmation: str(json.confirmation),
      clarification: str(json.clarification),
    };
  } catch {
    return null;
  }
}

/**
 * Turn a plain-English instruction into a structured knowledge patch.
 * The model integrates changes with CURRENT values so nothing is lost.
 */
export async function interpretCaraInstruction(
  context: CaraInstructionContext,
  instruction: string,
): Promise<InterpretInstructionResult> {
  const text = instruction.trim();
  if (text.length < 3) {
    return { ok: false, message: "Tell Cara what to change." };
  }

  const temporaryRule = tryParseTemporaryUnavailabilityRule(text);
  if (temporaryRule) {
    return {
      ok: true,
      patch: {
        ...EMPTY_PATCH,
        rulesAdd: [temporaryRule.rule],
        confirmation:
          "Done — added a temporary booking rule in Call handling.",
        clarification: "",
      },
    };
  }

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0.2,
      maxTokens: 700,
      messages: [
        {
          role: "system",
          content: `You update structured fields for Cara, an Irish business's AI phone receptionist. The owner gives a plain-English instruction. Return JSON only:
{
  "openingHours": "FULL updated opening-hours text, or null if unchanged",
  "serviceArea": "FULL updated areas covered, or null",
  "servicesOffered": "FULL updated services list, or null",
  "servicesNotOffered": "FULL updated 'do not offer' list, or null",
  "detailsToCollect": "FULL updated details-to-collect text, or null",
  "rulesAdd": ["short rule to always follow"],
  "rulesRemove": ["existing rule text to remove"],
  "faqsAdd": [{"question":"...","answer":"..."}],
  "anythingElseAppend": "a single extra fact for 'Anything else', or null",
  "confirmation": "one short friendly sentence naming the field AND tab updated, e.g. 'Done — Friday hours updated in General.' or 'Done — added a rule in Call handling.'",
  "clarification": "if unclear, one short question; else empty string"
}

Field → tab mapping:
- openingHours, serviceArea, business type facts, location → General
- servicesOffered, servicesNotOffered → Services
- detailsToCollect, rulesAdd/rulesRemove → Call handling
- faqsAdd → Answers & files
- anythingElseAppend → General ("Anything else Cara should know")

Rules:
- Only set fields the instruction clearly implies. Use null / empty arrays otherwise.
- When changing list-like fields, MERGE with current values and return the COMPLETE new text.
- "don't / never / stop doing X" → rulesAdd or servicesNotOffered.
- Temporary unavailability ("not taking [service] bookings until [time]") → rulesAdd only. Do NOT remove services from servicesOffered and do NOT add to servicesNotOffered.
- Never write free-form instruction blobs — only the structured fields above.
- If no matching field exists, set clarification asking whether to save to Anything else or as a common question.
- Keep confirmation to one sentence with field name and tab.`,
        },
        {
          role: "user",
          content: `Business: ${context.businessName} (${context.businessType || "business"})
Current opening hours: ${context.openingHours || "(none)"}
Current areas covered: ${context.serviceArea || "(none)"}
Current services offered: ${context.servicesOffered || "(none)"}
Current not offered: ${context.servicesNotOffered || "(none)"}
Current details to collect: ${context.detailsToCollect || "(none)"}
Current rules: ${context.rules.length ? context.rules.join(" | ") : "(none)"}
Anything else: ${context.anythingElse || "(none)"}
Existing FAQ questions: ${context.faqQuestions.length ? context.faqQuestions.join(" | ") : "(none)"}

Instruction:
${wrapUserContentForPrompt("instruction", text)}`,
        },
      ],
    });

    const patch = parsePatchJson(raw);
    if (!patch) return { ok: true, patch: { ...EMPTY_PATCH } };
    return { ok: true, patch };
  } catch (err) {
    console.warn("[cara-knowledge-instruction] interpret failed", err);
    return {
      ok: false,
      message: "Cara couldn't process that just now. Try again in a moment.",
    };
  }
}
