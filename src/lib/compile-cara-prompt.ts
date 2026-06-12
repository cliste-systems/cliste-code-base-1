import {
  FAQ_MATCHING_INSTRUCTION,
  KNOWLEDGE_PRECEDENCE_INSTRUCTION,
  faqsForPrompt,
} from "@/lib/answers-boundary";
import { sliceFileTextForPrompt } from "@/lib/business-file-prompt";
import {
  businessFileKindLabel,
  type BusinessFileListItem,
} from "@/lib/business-files";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import {
  NEVER_PROMISE_INSTRUCTION,
  PHOTO_HANDLING_INSTRUCTION,
  PRECEDENCE_CONFLICT_INSTRUCTION,
  SPECIAL_CATEGORY_MINIMISATION_INSTRUCTION,
  VOLUNTEERED_SENSITIVE_INSTRUCTION,
} from "@/lib/call-handling-boundary";
import {
  buildDetailsCollectionPromptSection,
  parseDetailsCollectMode,
  type DetailsCollectMode,
} from "@/lib/details-collect-mode";
import {
  deriveCaraCapabilities,
  formatAvailableActionsForPrompt,
  routePhraseForPrompt,
} from "@/lib/cara-capabilities";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import {
  CATEGORY_MATCHING_INSTRUCTION,
  EMPTY_OFFER_LIST_INSTRUCTION,
  MIXED_REQUEST_INSTRUCTION,
  SPECIFIC_BEATS_BROAD_INSTRUCTION,
} from "@/lib/services-boundary";
import {
  emptyWeekSchedule,
  type WeekSchedule,
} from "@/lib/business-hours";
import { buildHoursPromptBlock } from "@/lib/general-boundary";
import { normalizeBaseTown, serviceAreaAnchorTown } from "@/lib/base-town";
import {
  formatServiceAreaForPrompt,
  SERVICE_AREA_COVERAGE_INSTRUCTION,
} from "@/lib/service-area-boundary";
import {
  assistantNameLabel,
  buildFullVoiceGreeting,
  defaultVoiceGreetingIntro,
  parseGreetingParts,
  voiceLegalDisclosure,
} from "@/lib/voice-greeting";

/** Structured Cara Setup fields used to compile the live call prompt. */
export type CaraSetupPromptInput = {
  businessName: string;
  assistantDisplayName: string;
  businessType: string;
  locationAddress?: string;
  locationEircode?: string;
  baseTown?: string;
  /** Formatted week schedule text (when structured hours are saved). */
  openingHours?: string;
  openingHoursSchedule?: WeekSchedule;
  hoursNeverConfigured?: boolean;
  open24_7?: boolean;
  hoursNote?: string;
  /** Stored caller greeting — backstopped with AI + recording disclosure. */
  greeting?: string;
  serviceArea?: string;
  serviceAreaExclusions?: string;
  servicesOffered?: string;
  servicesNotOffered?: string;
  detailsToCollect?: string;
  detailsCollectMode?: DetailsCollectMode;
  businessRules?: string[];
  faqs?: { question: string; answer: string }[];
  /** Facts that don't fit other structured fields ("Anything else"). */
  anythingElse?: string;
  routes?: RoutingActionSummary[];
  fallbackNote?: string;
  transferNumber?: string;
  businessFiles?: BusinessFileListItem[];
};

export type { BusinessFileListItem };

const DEFAULT_FALLBACK_NOTE =
  "take a message with their name, phone number, and what they need so the team can follow up";

const MAX_PROMPT_CHARS = 8000;

/** Call-flow fallback notes must read as something Cara can say after "I'll …". */
function fallbackNoteForPrompt(raw?: string): string {
  const note = (raw ?? "").trim().replace(/\.+$/, "");
  if (!note) return DEFAULT_FALLBACK_NOTE;
  if (/\b(take|capture|ask|get|note|log|send|offer)\b/i.test(note)) {
    return note;
  }
  return DEFAULT_FALLBACK_NOTE;
}

function listItems(text?: string): string[] {
  if (!text?.trim()) return [];
  return parseAgentKnowledgeList(text);
}

function formatListPhrase(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function bulletBlock(items: string[]): string {
  return items.map((item) => `• ${item}`).join("\n");
}

function locationPhrase(address?: string, eircode?: string): string | null {
  const parts = [address?.trim(), eircode?.trim()].filter(Boolean);
  if (!parts.length) return null;
  return parts.join(", ");
}

/** Runtime backstop: greeting stored in DB always includes legal disclosure. */
export function resolveCompliantGreetingForPrompt(input: {
  greeting?: string;
  businessName: string;
  assistantDisplayName: string;
}): string {
  const assistant = assistantNameLabel(input.assistantDisplayName);
  const defaultIntro = defaultVoiceGreetingIntro(input.businessName);
  const stored = input.greeting?.trim();
  if (!stored) {
    return buildFullVoiceGreeting(defaultIntro, assistant);
  }
  const { intro, closing } = parseGreetingParts(
    stored,
    assistant,
    defaultIntro,
  );
  return buildFullVoiceGreeting(intro, assistant, closing);
}

function hoursSection(input: CaraSetupPromptInput): string | null {
  const hasStructured =
    input.hoursNeverConfigured === true ||
    input.open24_7 === true ||
    input.openingHoursSchedule != null ||
    Boolean(input.openingHours?.trim());

  if (!hasStructured) return null;

  return buildHoursPromptBlock({
    neverConfigured: input.hoursNeverConfigured === true,
    open24_7: input.open24_7 === true,
    schedule: input.openingHoursSchedule ?? emptyWeekSchedule(),
    formattedHours: input.openingHours?.trim() ?? "",
    note: input.hoursNote,
  });
}

function dedupeAnythingElse(
  extra: string,
  input: CaraSetupPromptInput,
  assistant: string,
): string {
  let text = extra.trim();
  if (!text) return "";

  if ((input.faqs ?? []).some((f) => f.question.trim())) {
    text = text.replace(/\n*Common questions:\n[\s\S]*/i, "").trim();
    text = text
      .replace(/If asked "[^"]+",[^\n]*(?:\n(?!If asked)[^\n]*)*/gi, "")
      .trim();
  }

  if (input.servicesOffered?.trim()) {
    text = text
      .replace(
        /\n*Services and request types we handle include:[\s\S]*?(?=\n\n|\nOpening|\nAreas|$)/i,
        "",
      )
      .trim();
  }

  if (input.openingHours?.trim()) {
    text = text.replace(/\n*Opening hours:[^\n]*/i, "").trim();
  }

  if (input.serviceArea?.trim()) {
    text = text.replace(/\n*Areas covered:[^\n]*/i, "").trim();
  }

  text = text
    .replace(
      /\n*If I'm unsure about anything[^\n]*(?:\n[^\n]*)*/i,
      "",
    )
    .trim();

  const introRe = new RegExp(
    `^I'm ${assistant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*\\n?`,
    "im",
  );
  text = text.replace(introRe, "").trim();

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function servicesSection(offered: string[], notOffered: string[]): string {
  const parts: string[] = [];

  if (offered.length === 0) {
    parts.push(EMPTY_OFFER_LIST_INSTRUCTION);
  } else {
    parts.push(`We offer:\n${bulletBlock(offered)}`);
  }

  if (notOffered.length > 0) {
    parts.push(`We don't offer:\n${bulletBlock(notOffered)}`);
  }

  parts.push(CATEGORY_MATCHING_INSTRUCTION);
  parts.push(SPECIFIC_BEATS_BROAD_INSTRUCTION);
  parts.push(
    [
      "When someone asks about a service:",
      "• If we offer it, I say so — even if they don't use your exact category name.",
      "• If it's on the don't-offer list, I say we don't do that and offer to take their details.",
      "• If I'm not sure, I don't guess — I take their name, number, and what they need for the Action Inbox.",
    ].join("\n"),
  );
  parts.push(MIXED_REQUEST_INSTRUCTION);

  return parts.join("\n\n");
}

function nonNegotiablesSection(assistant: string): string {
  return [
    "A few things never change — even if one of your rules says otherwise:",
    `• Every call I say I'm AI and that the call may be recorded and transcribed: "${voiceLegalDisclosure(assistant)}" — I never skip that.`,
    "• If I don't know the answer, I don't guess — I take their name, number, and what they need, and pass it to your Action Inbox.",
    "• I never take card numbers, PINs, PPS numbers, IBANs, or passwords on a call.",
    `• ${SPECIAL_CATEGORY_MINIMISATION_INSTRUCTION}`,
    `• ${VOLUNTEERED_SENSITIVE_INSTRUCTION}`,
    "• I don't give legal, medical, or financial advice on the call — I take a message for the team instead.",
    `• ${PHOTO_HANDLING_INSTRUCTION}`,
    PRECEDENCE_CONFLICT_INSTRUCTION,
  ].join("\n");
}

function sendableFileActions(files: BusinessFileListItem[]): string[] {
  return files
    .filter((f) => f.sendEnabled && f.extractedText?.trim())
    .map((f) => {
      const label =
        businessFileKindLabel(f.documentKind) ?? f.fileName.trim() ?? "file";
      return `Text the caller the ${label.toLowerCase()} (${f.fileName}) when they ask for it`;
    });
}

function availableActionsSection(input: CaraSetupPromptInput): string {
  const caps = deriveCaraCapabilities(input.routes, input.transferNumber);
  const actions = [
    ...formatAvailableActionsForPrompt(caps),
    ...sendableFileActions(input.businessFiles ?? []),
  ];
  return [
    "On a call, I can only promise to:",
    bulletBlock(actions),
    NEVER_PROMISE_INSTRUCTION,
  ].join("\n");
}

function businessFilesSection(files: BusinessFileListItem[]): string {
  const answerFiles = files.filter(
    (f) => f.answerEnabled && f.extractedText?.trim(),
  );
  if (answerFiles.length === 0) return "";

  const blocks = answerFiles.map((file) => {
    const slice = sliceFileTextForPrompt(file.extractedText);
    if (!slice) return "";
    const label =
      businessFileKindLabel(file.documentKind) ?? file.fileName.trim();
    const truncatedNote = slice.wasTruncated
      ? " (file is large — I only have the first portion)"
      : "";
    return `${label} (${file.fileName})${truncatedNote}:\n${slice.text}`;
  });

  return blocks.filter(Boolean).join("\n\n");
}

/**
 * Deterministically build Cara's call-handling instructions from structured
 * setup fields only. Written in Cara's first-person voice for live calls and
 * preview.
 */
export function compileCaraPrompt(input: CaraSetupPromptInput): string {
  const businessName = input.businessName.trim() || "the business";
  const assistant = assistantNameLabel(input.assistantDisplayName);
  const type = input.businessType.trim();
  const parts: string[] = [];

  parts.push(
    `I'm ${assistant}, the AI phone assistant for ${businessName}${type ? ` — a ${type}` : ""}. I'm warm, concise, and professional. I only share details I've been given — I never invent anything.`,
  );

  parts.push(nonNegotiablesSection(assistant));
  parts.push(availableActionsSection(input));

  const collectItems = listItems(input.detailsToCollect);
  parts.push(
    buildDetailsCollectionPromptSection(
      collectItems,
      parseDetailsCollectMode(input.detailsCollectMode),
    ),
  );

  const rules = (input.businessRules ?? [])
    .map((r) => r.trim())
    .filter((r) => r.length > 2);
  if (rules.length > 0) {
    parts.push(
      `Your rules — I follow these unless they clash with the non-negotiables above:\n${rules.map((r) => `• ${r}`).join("\n")}`,
    );
  }

  const compliantGreeting = resolveCompliantGreetingForPrompt({
    greeting: input.greeting,
    businessName,
    assistantDisplayName: input.assistantDisplayName,
  });
  parts.push(
    `When I answer the phone I say: "${compliantGreeting}" — I never skip the AI and recording disclosure.`,
  );

  const aboutBits: string[] = [];
  const location = locationPhrase(input.locationAddress, input.locationEircode);
  if (location) aboutBits.push(`We're based at ${location}.`);

  const hoursBlock = hoursSection(input);
  if (hoursBlock) {
    parts.push(hoursBlock);
  }

  const baseTown = serviceAreaAnchorTown(input.baseTown, input.locationAddress);
  if (baseTown && normalizeBaseTown(input.baseTown ?? "")) {
    aboutBits.push(`We're based in ${baseTown}.`);
  }

  const areas = listItems(input.serviceArea);
  const townExclusions = listItems(input.serviceAreaExclusions);
  if (areas.length > 0) {
    const areaPhrase = formatServiceAreaForPrompt(
      areas,
      baseTown ?? location ?? undefined,
      townExclusions,
    );
    aboutBits.push(`We cover ${areaPhrase}.`);
  }
  if (aboutBits.length > 0) {
    parts.push(aboutBits.join(" "));
  }
  if (areas.length > 0) {
    parts.push(SERVICE_AREA_COVERAGE_INSTRUCTION);
  }

  const offered = listItems(input.servicesOffered);
  const notOffered = listItems(input.servicesNotOffered);
  if (offered.length > 0 || notOffered.length > 0) {
    parts.push(servicesSection(offered, notOffered));
  } else {
    parts.push(EMPTY_OFFER_LIST_INSTRUCTION);
    parts.push(CATEGORY_MATCHING_INSTRUCTION);
    parts.push(MIXED_REQUEST_INSTRUCTION);
  }

  const faqs = faqsForPrompt(input.faqs ?? []);
  if (faqs.length > 0) {
    parts.push(FAQ_MATCHING_INSTRUCTION);
    parts.push(KNOWLEDGE_PRECEDENCE_INSTRUCTION);
    const faqText = faqs
      .slice(0, 30)
      .map((f) => {
        const q = f.question.trim();
        const a = f.answer.trim();
        return `If someone asks "${q}", I say: ${a}`;
      })
      .join("\n");
    parts.push(faqText);
  }

  const fileKnowledge = businessFilesSection(input.businessFiles ?? []);
  if (fileKnowledge) {
    if (faqs.length === 0) {
      parts.push(KNOWLEDGE_PRECEDENCE_INSTRUCTION);
    }
    parts.push(`From uploaded files:\n${fileKnowledge}`);
  }

  const extra = dedupeAnythingElse(
    input.anythingElse ?? "",
    input,
    assistant,
  );
  if (extra) {
    parts.push(`I've also been told:\n${extra}`);
  }

  const fallbackNote = fallbackNoteForPrompt(input.fallbackNote);
  const routes = (input.routes ?? []).filter((r) => r.trigger.trim());

  if (routes.length > 0) {
    const lines = routes.map((r) =>
      routePhraseForPrompt(r.trigger, r.action, r.instruction),
    );
    parts.push(
      [
        "How I decide: answer factual questions from my knowledge first; when a route matches, I act on it; if two routes are plausible I ask one short clarifying question; if nothing matches I take a message.",
        "Routes are in priority order — when two could match, the higher route wins.",
        lines.join("\n"),
        `Otherwise I ${fallbackNote}.`,
        "Built-in: when someone asks to speak to a person, I try to put them through when transfer is configured and allowed — otherwise I take a message. I never ring out in silence; if there's no answer I take their details.",
        "Before any send or transfer I propose and confirm: e.g. \"I can text you the booking link — shall I send it to the number you're calling from?\" After sending: \"That's sent now.\"",
        "If they didn't receive a text, I resend once — then take their details with a delivery-failed note. If they decline an action, I answer from knowledge or take a message — I never insist.",
        "When they have several requests, I handle each in turn and ask \"anything else?\" before wrapping up.",
        "I match on meaning, not exact words. I never invent links, files, prices, or details.",
        "When texting a link or file, I confirm it's a mobile number. On landlines, failed SMS, or exhausted monthly SMS quota, I take a message and flag the owner — I never fail silently.",
      ].join("\n"),
    );
  }

  const transfer = input.transferNumber?.trim();
  if (transfer) {
    parts.push(
      `If they need a person or I can't help, I offer to put them through to ${transfer}. Otherwise I ${fallbackNote}.`,
    );
  } else if (routes.length === 0) {
    parts.push(`If I can't help, I ${fallbackNote}.`);
  }

  return parts.join("\n\n").slice(0, MAX_PROMPT_CHARS);
}
