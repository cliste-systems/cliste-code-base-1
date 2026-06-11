import { faqsForPrompt } from "@/lib/answers-boundary";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import {
  businessFileKindLabel,
  type BusinessFileListItem,
} from "@/lib/business-files";
import { CARA_WHEN_UNSURE_LOCKED_COPY } from "@/lib/call-handling-boundary";
import type { CaraSetupPromptInput } from "@/lib/compile-cara-prompt";
import { emptyWeekSchedule } from "@/lib/business-hours";
import { buildHoursPromptBlock } from "@/lib/general-boundary";
import { routePhraseForPrompt } from "@/lib/cara-capabilities";
import {
  formatServiceAreaForPrompt,
  SERVICE_AREA_COVERAGE_INSTRUCTION,
} from "@/lib/service-area-boundary";
import {
  assistantNameLabel,
  voiceLegalDisclosure,
  VOICE_LEGAL_NOTICE_HINT,
} from "@/lib/voice-greeting";

export type CaraLockedPreviewItem = {
  title: string;
  body: string;
};

export type CaraOwnerPreview = {
  /** Short first-person summary of what Cara knows about this business. */
  voice: string;
  /** Fixed behaviour — shown separately; owners cannot edit these. */
  locked: CaraLockedPreviewItem[];
};

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

function locationPhrase(address?: string, eircode?: string): string | null {
  const parts = [address?.trim(), eircode?.trim()].filter(Boolean);
  if (!parts.length) return null;
  return parts.join(", ");
}

function callFlowVoiceLines(input: CaraSetupPromptInput): string[] {
  const lines: string[] = [];
  const routes = (input.routes ?? []).filter((r) => r.trigger.trim());

  for (const route of routes) {
    lines.push(routePhraseForPrompt(route.trigger, route.action));
  }

  if (input.transferNumber?.trim()) {
    lines.push("If they need a person, I can put them through to the team.");
  }

  return lines;
}

function dedupeAnythingElseForPreview(
  extra: string,
  input: CaraSetupPromptInput,
  assistant: string,
): string {
  let text = extra.trim();
  if (!text) return "";

  if ((input.faqs ?? []).some((f) => f.question.trim())) {
    text = text.replace(/\n*Common questions:\n[\s\S]*/i, "").trim();
  }

  const introRe = new RegExp(
    `^I'm ${assistant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*\\n?`,
    "im",
  );
  text = text.replace(introRe, "").trim();
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function buildLockedSection(assistant: string): CaraLockedPreviewItem[] {
  return [
    {
      title: "AI disclosure",
      body: `Every call opens with: "${voiceLegalDisclosure(assistant)}" ${VOICE_LEGAL_NOTICE_HINT}`,
    },
    {
      title: "When she's unsure",
      body: CARA_WHEN_UNSURE_LOCKED_COPY,
    },
    {
      title: "Payment & security",
      body: "She never collects card numbers, PINs, or passwords on a call.",
    },
    {
      title: "Professional advice",
      body: "She won't give legal, medical, or financial advice on a call — she takes a message for the team instead.",
    },
    {
      title: "Photos & video",
      body: "She can't receive images on a call. If a caller mentions them, she notes it and moves on.",
    },
    {
      title: "Your rules",
      body: "Business rules can't override any of the above.",
    },
  ];
}

/**
 * Owner-facing preview for "In Cara's words" — short business summary plus
 * locked defaults shown in separate UI. Live calls still use compileCaraPrompt().
 */
export function compileCaraOwnerPreview(
  input: CaraSetupPromptInput,
): CaraOwnerPreview {
  const businessName = input.businessName.trim() || "the business";
  const assistant = assistantNameLabel(input.assistantDisplayName);
  const type = input.businessType.trim();
  const parts: string[] = [];

  parts.push(
    `I'm ${assistant}, the phone assistant for ${businessName}${type ? ` — a ${type}` : ""}. I'm warm, friendly, and professional. I only say what you've told me about the business.`,
  );

  const aboutBits: string[] = [];
  const location = locationPhrase(input.locationAddress, input.locationEircode);
  if (location) aboutBits.push(`We're at ${location}.`);

  const hoursBlock = buildHoursPromptBlock({
    neverConfigured: input.hoursNeverConfigured === true,
    open24_7: input.open24_7 === true,
    schedule: input.openingHoursSchedule ?? emptyWeekSchedule(),
    formattedHours: input.openingHours?.trim() ?? "",
    note: input.hoursNote,
  });
  if (hoursBlock) {
    parts.push(hoursBlock);
  }

  const areas = listItems(input.serviceArea);
  const townExclusions = listItems(input.serviceAreaExclusions);
  if (areas.length > 0) {
    const areaPhrase = formatServiceAreaForPrompt(
      areas,
      location ?? undefined,
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
  if (offered.length > 0) {
    parts.push(`What we offer: ${formatListPhrase(offered)}.`);
  } else {
    parts.push(
      "You haven't listed what you offer yet — I'll take a message for work enquiries.",
    );
  }
  if (notOffered.length > 0) {
    parts.push(`What we don't offer: ${formatListPhrase(notOffered)}.`);
  }

  const collectItems = listItems(input.detailsToCollect);
  if (collectItems.length > 0) {
    parts.push(
      `I always get name and number. When it fits the call, I also try to learn: ${formatListPhrase(collectItems)}.`,
    );
  }

  const rules = (input.businessRules ?? [])
    .map((r) => r.trim())
    .filter((r) => r.length > 2);
  if (rules.length > 0) {
    parts.push(
      `Rules I follow:\n${rules.map((r) => `• ${r}`).join("\n")}`,
    );
  }

  const callFlow = callFlowVoiceLines(input);
  if (callFlow.length > 0) {
    parts.push(callFlow.join(" "));
  }

  const faqs = faqsForPrompt(input.faqs ?? []);
  if (faqs.length > 0) {
    const faqLines = faqs
      .slice(0, 12)
      .map((f) => `"${f.question.trim()}" — ${f.answer.trim()}`)
      .join("\n");
    parts.push(`Common questions:\n${faqLines}`);
  }

  const answerFiles = (input.businessFiles ?? []).filter(
    (f) => f.answerEnabled && f.extractedText?.trim(),
  );
  const sendFiles = (input.businessFiles ?? []).filter(
    (f) => f.sendEnabled && f.extractedText?.trim(),
  );
  if (answerFiles.length > 0) {
    const names = answerFiles
      .map((f) => businessFileKindLabel(f.documentKind) ?? f.fileName)
      .join(", ");
    parts.push(`I can answer from your uploaded ${names}.`);
  }
  if (sendFiles.length > 0) {
    const names = sendFiles
      .map((f) => businessFileKindLabel(f.documentKind) ?? f.fileName)
      .join(", ");
    parts.push(`I can text callers your ${names} when they ask.`);
  }

  const extra = dedupeAnythingElseForPreview(
    input.anythingElse ?? "",
    input,
    assistant,
  );
  if (extra) {
    parts.push(extra);
  }

  const voice = parts.join("\n\n").trim();

  return {
    voice: voice || `I'm ${assistant} for ${businessName}. Add your business details above to fill this in.`,
    locked: buildLockedSection(assistant),
  };
}
