/**
 * Source-of-truth precedence for Cara knowledge surfaces.
 */

import type { BusinessFileKind, BusinessFileListItem } from "@/lib/business-files";
import { isBusinessFileKind } from "@/lib/business-files";

export type KnowledgeFactType =
  | "services"
  | "prices"
  | "faqs"
  | "hours"
  | "serviceArea"
  | "policies"
  | "conduct"
  | "identity";

export type KnowledgeSourceRank = "structured" | "freeText" | "uploadedFiles";

/** File kinds that duplicate structured Services or FAQ knowledge. */
export const OVERLAPPING_CATALOG_FILE_KINDS = [
  "price_list",
  "service_sheet",
  "menu",
] as const satisfies readonly BusinessFileKind[];

export const OVERLAPPING_FAQ_FILE_KINDS = [
  "faq_document",
] as const satisfies readonly BusinessFileKind[];

export const OVERLAPPING_KNOWLEDGE_FILE_KINDS = [
  ...OVERLAPPING_CATALOG_FILE_KINDS,
  ...OVERLAPPING_FAQ_FILE_KINDS,
] as const;

export type OverlappingKnowledgeFileKind =
  (typeof OVERLAPPING_KNOWLEDGE_FILE_KINDS)[number];

export function isOverlappingKnowledgeFileKind(
  kind: string | null | undefined,
): kind is OverlappingKnowledgeFileKind {
  if (!kind || !isBusinessFileKind(kind)) return false;
  return (OVERLAPPING_KNOWLEDGE_FILE_KINDS as readonly string[]).includes(kind);
}

export function overlapsCatalogKnowledge(
  kind: string | null | undefined,
): boolean {
  if (!kind || !isBusinessFileKind(kind)) return false;
  return (OVERLAPPING_CATALOG_FILE_KINDS as readonly string[]).includes(kind);
}

export function overlapsFaqKnowledge(kind: string | null | undefined): boolean {
  return kind === "faq_document";
}

export function shouldDefaultAnswerEnabledOff(input: {
  documentKind: string | null | undefined;
  hasServiceCatalog: boolean;
  hasFaqs: boolean;
  processingStatus: string;
  hasExtractedText: boolean;
}): boolean {
  if (input.processingStatus !== "ready" || !input.hasExtractedText) {
    return false;
  }
  if (
    input.hasServiceCatalog &&
    overlapsCatalogKnowledge(input.documentKind)
  ) {
    return true;
  }
  if (input.hasFaqs && overlapsFaqKnowledge(input.documentKind)) {
    return true;
  }
  return false;
}

export function showSendOnlyOverlapNote(input: {
  file: Pick<
    BusinessFileListItem,
    "answerEnabled" | "documentKind" | "processingStatus" | "extractedText"
  >;
  hasServiceCatalog: boolean;
  hasFaqs: boolean;
}): "catalog" | "faqs" | null {
  const { file } = input;
  if (file.answerEnabled) return null;
  if (file.processingStatus !== "ready" || !file.extractedText?.trim()) {
    return null;
  }
  if (
    input.hasServiceCatalog &&
    overlapsCatalogKnowledge(file.documentKind)
  ) {
    return "catalog";
  }
  if (input.hasFaqs && overlapsFaqKnowledge(file.documentKind)) {
    return "faqs";
  }
  return null;
}

export const SEND_ONLY_CATALOG_OVERLAP_NOTE =
  "Your Services menu already covers this, so Cara uses the menu. This file is saved for sending to callers. Turn on \"Cara reads from this\" if you want her to read from it too.";

export const SEND_ONLY_FAQ_OVERLAP_NOTE =
  "Your FAQ answers already cover this, so Cara uses those. This file is saved for sending to callers. Turn on \"Cara reads from this\" if you want her to read from it too.";

export const KNOWLEDGE_PRECEDENCE_INSTRUCTION =
  "When several sources could answer, I use this order: (1) structured setup — services menu, opening hours, areas, location, and business rules; (2) common-question answers; (3) uploaded file content. If sources disagree, I use the highest-priority source and do not mention the discrepancy to the caller.";

export const FILE_REFERENCE_PRECEDENCE_INSTRUCTION =
  "The uploaded documents in my knowledge are background reference only. If anything in them disagrees with my Services menu, opening hours, or common-question answers, those structured sources are correct — I rely on them and do not quote conflicting prices or details from documents.";

export const PROTECTED_PRECEDENCE_PART_ID = "knowledgePrecedence";

function hasAnswerEnabledFileKnowledge(
  files: BusinessFileListItem[] | undefined,
): boolean {
  return (files ?? []).some(
    (f) => f.answerEnabled && Boolean(f.extractedText?.trim()),
  );
}

/** Protected prompt parts — never dropped by the budget trimmer. */
export function buildProtectedKnowledgePrecedenceParts(input: {
  businessFiles?: BusinessFileListItem[];
}): string[] {
  const parts = [KNOWLEDGE_PRECEDENCE_INSTRUCTION];
  if (hasAnswerEnabledFileKnowledge(input.businessFiles)) {
    parts.push(FILE_REFERENCE_PRECEDENCE_INSTRUCTION);
  }
  return parts;
}
