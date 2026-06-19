import {
  FAQ_MATCHING_INSTRUCTION,
  faqsForPrompt,
} from "@/lib/answers-boundary";
import {
  buildProtectedKnowledgePrecedenceParts,
} from "@/lib/knowledge-precedence";
import {
  CARA_KNOWLEDGE_DROP_ORDER,
  sortDroppableSectionsByRegistry,
} from "@/lib/knowledge-surfaces";
import {
  BUSINESS_FILE_LOOKUP_INSTRUCTION,
  buildBusinessFileMetadataBlock,
  buildLargeFilePromptIndex,
  sliceFileTextForPrompt,
} from "@/lib/business-file-prompt";
import {
  businessFileKindLabel,
  type BusinessFileListItem,
} from "@/lib/business-files";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import {
  catalogHasExtractedPrices,
  type ServiceCatalogItem,
} from "@/lib/service-catalog-format";
import { compileServiceCatalogKnowledgeLine } from "@/lib/service-policy-presets";
import {
  filterSupplementAgainstCatalog,
  hasServiceCatalogSupplement,
  type ServiceCatalogSupplement,
} from "@/lib/service-catalog-supplement";
import {
  NEVER_PROMISE_INSTRUCTION,
  NEVER_QUOTE_PRICE_PATTERN,
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
import {
  caraConductSection,
  type CaraConduct,
} from "@/lib/agent-cara-conduct";
import { resolveBusinessRuleForPrompt } from "@/lib/business-rule-presets";
import { verticalPackForNiche } from "@/lib/verticals";

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
  /** Structured salon service menu (when catalog is in use). */
  serviceCatalog?: ServiceCatalogItem[];
  /** Net-new services and policy notes from owner own-words (salon + catalog). */
  serviceCatalogSupplement?: ServiceCatalogSupplement;
  detailsToCollect?: string;
  detailsCollectMode?: DetailsCollectMode;
  businessRules?: string[];
  caraRules?: string[];
  caraConduct?: CaraConduct;
  quotePricesOnCalls?: boolean;
  faqs?: { question: string; answer: string }[];
  /** Organization niche — used to skip trade-style coverage copy for salons. */
  niche?: string;
  /** Facts that don't fit other structured fields ("Anything else"). Legacy onboarding only. */
  anythingElse?: string;
  routes?: RoutingActionSummary[];
  fallbackNote?: string;
  transferNumber?: string;
  businessFiles?: BusinessFileListItem[];
};

export type CaraCompileMeta = {
  wasTrimmed: boolean;
  droppedFaqCount: number;
  droppedFileKnowledge: boolean;
  droppedAnythingElse: boolean;
  droppedSupplement: boolean;
  coreOverflow: boolean;
  estimatedTokens: number;
  charCount: number;
  nearBudget: boolean;
};

export type CaraCompileResult = {
  prompt: string;
  compileMeta: CaraCompileMeta;
};

export type { BusinessFileListItem };

export const MAX_PROMPT_CHARS = 24000;
export const PROMPT_BUDGET_WARN_RATIO = 0.8;

const DEFAULT_FALLBACK_NOTE =
  "take a message with their name, phone number, and what they need so the team can follow up";

/** Rough token estimate — chars ÷ 4, no tokenizer dependency. */
export function estimatePromptTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Call-flow fallback notes must read as something Cara can say after "I'll …". */
function fallbackNoteForPrompt(raw?: string): string {
  const note = (raw ?? "").trim().replace(/\.+$/, "");
  if (!note) return DEFAULT_FALLBACK_NOTE;
  if (/\b(take|capture|ask|get|note|log|send|offer)\b/i.test(note)) {
    return note;
  }
  return DEFAULT_FALLBACK_NOTE;
}

function joinPromptParts(parts: string[]): string {
  return parts.filter(Boolean).join("\n\n");
}

function listItems(text?: string): string[] {
  if (!text?.trim()) return [];
  return parseAgentKnowledgeList(text);
}

function bulletBlock(items: string[]): string {
  return items.map((item) => `• ${item}`).join("\n");
}

function locationPhrase(address?: string, eircode?: string): string | null {
  const parts = [address?.trim(), eircode?.trim()].filter(Boolean);
  if (!parts.length) return null;
  return parts.join(", ");
}

/** Sanitize owner free text embedded in quoted prompt lines. */
export function sanitizePromptFreeText(text: string): string {
  return text.replace(/"/g, "'");
}

/** @deprecated use sanitizePromptFreeText */
export function escapeFaqTextForPrompt(text: string): string {
  return sanitizePromptFreeText(text);
}

function formatFaqLine(question: string, answer: string): string {
  const q = sanitizePromptFreeText(question.trim());
  const a = sanitizePromptFreeText(answer.trim());
  return `If someone asks "${q}", I say: ${a}`;
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

/** Legacy onboarding path — strips duplicate prose when structured fields exist. */
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

function catalogPricingLine(
  services: ServiceCatalogItem[],
  businessRules: string[],
  quotePricesOnCalls?: boolean,
): string {
  const ownerSaysNeverQuote = businessRules.some((r) =>
    NEVER_QUOTE_PRICE_PATTERN.test(r),
  );
  const shouldQuote =
    quotePricesOnCalls !== false &&
    catalogHasExtractedPrices(services) &&
    !ownerSaysNeverQuote;

  if (shouldQuote) {
    return 'When someone asks about price and a service has a price listed above, I quote it with "from" or "about" — I never invent prices that are not listed.';
  }
  return "I do not quote prices on the phone from this menu — I offer to text the booking link or take their details for the team.";
}

function serviceCatalogCoreSection(
  services: ServiceCatalogItem[],
  businessRules: string[],
  quotePricesOnCalls?: boolean,
): string {
  const lines = services
    .map((s) => compileServiceCatalogKnowledgeLine(s))
    .filter(Boolean);

  return [
    "Services menu:",
    bulletBlock(lines),
    "When someone asks how long a service takes, I use the durations above when listed.",
    catalogPricingLine(services, businessRules, quotePricesOnCalls),
    "If a service is not listed, I do not guess — I take their name, number, and what they need.",
  ].join("\n");
}

function serviceCatalogSupplementSection(
  services: ServiceCatalogItem[],
  supplement?: ServiceCatalogSupplement,
): string {
  const catalogNames = services.map((s) => s.name);
  const filteredSupplement = supplement
    ? filterSupplementAgainstCatalog(supplement, catalogNames)
    : undefined;

  if (!filteredSupplement || !hasServiceCatalogSupplement(filteredSupplement)) {
    return "";
  }

  const parts: string[] = [];
  if (filteredSupplement.supplementalServices.length > 0) {
    parts.push(
      "Also offered (not on the menu above):",
      bulletBlock(filteredSupplement.supplementalServices),
    );
  }
  if (filteredSupplement.generalNotes.trim()) {
    parts.push(
      `Also worth knowing about services: ${filteredSupplement.generalNotes.trim()}`,
    );
  }
  return parts.join("\n");
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

  let hasLargeFile = false;
  const blocks = answerFiles.map((file) => {
    const raw = file.extractedText?.trim() ?? "";
    const slice = sliceFileTextForPrompt(raw);
    if (!slice) return "";
    const label =
      businessFileKindLabel(file.documentKind) ?? file.fileName.trim();
    const metadata = buildBusinessFileMetadataBlock(file);
    const displayName = file.title?.trim() || file.fileName.trim();

    if (slice.wasTruncated) {
      hasLargeFile = true;
      return buildLargeFilePromptIndex(raw, file.fileName.trim(), label, undefined, {
        title: file.title,
        caraDescription: file.caraDescription,
        whenToUse: file.whenToUse,
      });
    }

    const body = [metadata, slice.text].filter(Boolean).join("\n\n");
    return `${label} (${displayName}):\n${body}`;
  });

  const body = blocks.filter(Boolean).join("\n\n");
  if (!body) return "";

  if (hasLargeFile) {
    return `${BUSINESS_FILE_LOOKUP_INSTRUCTION}\n\n${body}`;
  }

  return body;
}

const KNOWLEDGE_OMITTED_NOTE =
  "Note: some FAQs, files, or service knowledge was shortened to fit my instructions — if a caller asks something I no longer have, I take a message for the team.";

type DroppableSection = {
  id: string;
  parts: string[];
  /** When true, trim one FAQ line at a time from the end before dropping the whole section. */
  trimFaqLines?: boolean;
};

function assemblePromptWithBudget(
  protectedParts: string[],
  droppableSections: DroppableSection[],
  initialFaqCount: number,
): CaraCompileResult {
  const meta: CaraCompileMeta = {
    wasTrimmed: false,
    droppedFaqCount: 0,
    droppedFileKnowledge: false,
    droppedAnythingElse: false,
    droppedSupplement: false,
    coreOverflow: false,
    estimatedTokens: 0,
    charCount: 0,
    nearBudget: false,
  };

  const sections = droppableSections.map((s) => ({
    ...s,
    parts: [...s.parts],
  }));

  const build = () => {
    const trimmable = sections.flatMap((s) => s.parts);
    const parts = [...protectedParts, ...trimmable];
    if (meta.wasTrimmed) {
      parts.push(KNOWLEDGE_OMITTED_NOTE);
    }
    return joinPromptParts(parts);
  };

  let prompt = build();

  const dropWholeSection = (id: string): boolean => {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx < 0 || sections[idx]!.parts.length === 0) return false;
    if (id === "files") meta.droppedFileKnowledge = true;
    if (id === "anythingElse") meta.droppedAnythingElse = true;
    if (id === "supplement") meta.droppedSupplement = true;
    sections[idx]!.parts = [];
    meta.wasTrimmed = true;
    return true;
  };

  const trimFaqLine = (): boolean => {
    const faq = sections.find((s) => s.id === "faqs");
    if (!faq || faq.parts.length <= 2) return false;
    faq.parts = faq.parts.slice(0, -1);
    meta.droppedFaqCount += 1;
    meta.wasTrimmed = true;
    return true;
  };

  const trimOrder: Array<() => boolean> = [
    ...CARA_KNOWLEDGE_DROP_ORDER.filter((id) => id !== "faqs").map(
      (id) => () => dropWholeSection(id),
    ),
    () => trimFaqLine(),
    () => {
      const faq = sections.find((s) => s.id === "faqs");
      if (!faq || faq.parts.length === 0) return false;
      meta.droppedFaqCount = initialFaqCount;
      faq.parts = [];
      meta.wasTrimmed = true;
      return true;
    },
  ];

  let guard = 0;
  while (prompt.length > MAX_PROMPT_CHARS && guard < 300) {
    guard += 1;
    let progressed = false;
    for (const step of trimOrder) {
      if (step()) {
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
    prompt = build();
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    meta.coreOverflow = true;
    meta.wasTrimmed = true;
  }

  meta.charCount = prompt.length;
  meta.estimatedTokens = estimatePromptTokens(prompt);
  meta.nearBudget =
    prompt.length >= MAX_PROMPT_CHARS * PROMPT_BUDGET_WARN_RATIO;

  return { prompt, compileMeta: meta };
}

function buildProtectedParts(
  input: CaraSetupPromptInput,
  businessName: string,
  assistant: string,
): string[] {
  const parts: string[] = [];

  parts.push(
    `I'm ${assistant}, the AI phone assistant for ${businessName}${input.businessType.trim() ? ` — a ${input.businessType.trim()}` : ""}. I'm warm, concise, and professional. I only share details I've been given — I never invent anything.`,
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

  const fallbackNote = fallbackNoteForPrompt(input.fallbackNote);
  const routes = (input.routes ?? []).filter((r) => r.trigger.trim());

  if (routes.length > 0) {
    const lines = routes.map((r) =>
      routePhraseForPrompt(
        sanitizePromptFreeText(r.trigger),
        r.action,
        r.instruction
          ? sanitizePromptFreeText(r.instruction)
          : undefined,
      ),
    );
    parts.push(
      [
        "How I decide: answer factual questions from my knowledge first; when a route matches, I act on it; if two routes are plausible I ask one short clarifying question; if nothing matches I take a message.",
        "Routes are in priority order — when two could match, the higher route wins.",
        lines.join("\n"),
        `Otherwise I ${fallbackNote}.`,
        "Built-in: when someone asks to speak to a person, I try to put them through when transfer is configured and allowed — otherwise I take a message. I never ring out in silence; if there's no answer I take their details.",
        'Before any send or transfer I propose and confirm: e.g. "I can text you the booking link — shall I send it to the number you\'re calling from?" After sending: "That\'s sent now."',
        "If they didn't receive a text, I resend once — then take their details with a delivery-failed note. If they decline an action, I answer from knowledge or take a message — I never insist.",
        'When they have several requests, I handle each in turn and ask "anything else?" before wrapping up.',
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

  parts.push(...buildProtectedKnowledgePrecedenceParts(input));

  return parts;
}

function buildDroppableSections(
  input: CaraSetupPromptInput,
  businessName: string,
  assistant: string,
): { sections: DroppableSection[]; faqCount: number } {
  const sections: DroppableSection[] = [];

  const rules = (input.businessRules ?? [])
    .map((r) => sanitizePromptFreeText(resolveBusinessRuleForPrompt(r)))
    .filter((r) => r.length > 2);
  if (rules.length > 0) {
    sections.push({
      id: "businessRules",
      parts: [
        `Your rules — I follow these unless they clash with the non-negotiables above:\n${rules.map((r) => `• ${r}`).join("\n")}`,
      ],
    });
  }

  if (input.caraConduct) {
    sections.push({
      id: "caraConduct",
      parts: [
        `${caraConductSection(input.caraConduct)} — unless this clashes with the non-negotiables or business rules above.`,
      ],
    });
  } else {
    const caraRules = (input.caraRules ?? [])
      .map((r) => sanitizePromptFreeText(r.trim()))
      .filter((r) => r.length > 2);
    if (caraRules.length > 0) {
      sections.push({
        id: "caraConduct",
        parts: [
          `How I should handle your calls — unless this clashes with the non-negotiables or business rules above:\n${caraRules.map((r) => `• ${r}`).join("\n")}`,
        ],
      });
    }
  }

  const compliantGreeting = resolveCompliantGreetingForPrompt({
    greeting: input.greeting,
    businessName,
    assistantDisplayName: input.assistantDisplayName,
  });
  sections.push({
    id: "greeting",
    parts: [
      `When I answer the phone I say: "${sanitizePromptFreeText(compliantGreeting)}" — I never skip the AI and recording disclosure.`,
    ],
  });

  const locationParts: string[] = [];
  const aboutBits: string[] = [];
  const location = locationPhrase(input.locationAddress, input.locationEircode);
  if (location) aboutBits.push(`We're based at ${location}.`);

  const hoursBlock = hoursSection(input);
  if (hoursBlock) locationParts.push(hoursBlock);

  const baseTown = serviceAreaAnchorTown(input.baseTown, input.locationAddress);
  if (baseTown && normalizeBaseTown(input.baseTown ?? "")) {
    aboutBits.push(`We're based in ${baseTown}.`);
  }

  const areas = listItems(input.serviceArea);
  const townExclusions = listItems(input.serviceAreaExclusions);
  const skipServiceArea = verticalPackForNiche(input.niche ?? "").capabilities
    .skipServiceArea;
  if (areas.length > 0 && !skipServiceArea) {
    const areaPhrase = formatServiceAreaForPrompt(
      areas,
      baseTown ?? location ?? undefined,
      townExclusions,
    );
    aboutBits.push(`We cover ${areaPhrase}.`);
  }
  if (aboutBits.length > 0) locationParts.push(aboutBits.join(" "));
  if (areas.length > 0 && !skipServiceArea) {
    locationParts.push(SERVICE_AREA_COVERAGE_INSTRUCTION);
  }
  if (locationParts.length > 0) {
    sections.push({ id: "location", parts: locationParts });
  }

  const catalog = input.serviceCatalog ?? [];
  const offered = listItems(input.servicesOffered);
  const notOffered = listItems(input.servicesNotOffered);
  const businessRules = input.businessRules ?? [];
  const catalogParts: string[] = [];

  if (catalog.length > 0) {
    catalogParts.push(
      serviceCatalogCoreSection(
        catalog,
        businessRules.map((r) => resolveBusinessRuleForPrompt(r)),
        input.quotePricesOnCalls,
      ),
    );
    if (notOffered.length > 0) {
      catalogParts.push(`We don't offer:\n${bulletBlock(notOffered)}`);
    }
    catalogParts.push(CATEGORY_MATCHING_INSTRUCTION);
    catalogParts.push(SPECIFIC_BEATS_BROAD_INSTRUCTION);
    catalogParts.push(MIXED_REQUEST_INSTRUCTION);
  } else if (offered.length > 0 || notOffered.length > 0) {
    catalogParts.push(servicesSection(offered, notOffered));
  } else {
    catalogParts.push(EMPTY_OFFER_LIST_INSTRUCTION);
    catalogParts.push(CATEGORY_MATCHING_INSTRUCTION);
    catalogParts.push(MIXED_REQUEST_INSTRUCTION);
  }
  if (catalogParts.length > 0) {
    sections.push({ id: "catalog", parts: catalogParts });
  }

  const faqs = faqsForPrompt(input.faqs ?? []).slice(0, 30);
  const faqParts: string[] = [];
  if (faqs.length > 0) {
    faqParts.push(FAQ_MATCHING_INSTRUCTION);
    for (const f of faqs) {
      faqParts.push(formatFaqLine(f.question, f.answer));
    }
    sections.push({ id: "faqs", parts: faqParts, trimFaqLines: true });
  }

  const supplementText =
    catalog.length > 0
      ? serviceCatalogSupplementSection(
          catalog,
          input.serviceCatalogSupplement,
        )
      : "";
  if (supplementText) {
    sections.push({ id: "supplement", parts: [supplementText] });
  }

  const fileKnowledgeText = businessFilesSection(input.businessFiles ?? []);
  if (fileKnowledgeText) {
    sections.push({
      id: "files",
      parts: [
        `Background reference — from uploaded files:\n${fileKnowledgeText}`,
      ],
    });
  }

  const extra = dedupeAnythingElse(input.anythingElse ?? "", input, assistant);
  if (extra) {
    sections.push({
      id: "anythingElse",
      parts: [`I've also been told:\n${extra}`],
    });
  }

  return {
    sections: sortDroppableSectionsByRegistry(sections),
    faqCount: faqs.length,
  };
}

/** Section ids emitted for a given input — for registry guardrail tests. */
export function droppableSectionIdsForInput(
  input: CaraSetupPromptInput,
): string[] {
  const businessName = input.businessName.trim() || "the business";
  const assistant = assistantNameLabel(input.assistantDisplayName);
  const { sections } = buildDroppableSections(input, businessName, assistant);
  return sections.map((s) => s.id);
}

/**
 * Deterministically build Cara's call-handling instructions from structured
 * setup fields only. Written in Cara's first-person voice for live calls and
 * preview.
 */
export function compileCaraPromptWithMeta(
  input: CaraSetupPromptInput,
): CaraCompileResult {
  const businessName = input.businessName.trim() || "the business";
  const assistant = assistantNameLabel(input.assistantDisplayName);
  const protectedParts = buildProtectedParts(input, businessName, assistant);
  const { sections, faqCount } = buildDroppableSections(
    input,
    businessName,
    assistant,
  );
  return assemblePromptWithBudget(protectedParts, sections, faqCount);
}

/** String-only compile — most callers use this. */
export function compileCaraPrompt(input: CaraSetupPromptInput): string {
  return compileCaraPromptWithMeta(input).prompt;
}
