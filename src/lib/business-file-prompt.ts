/**
 * Token/character budget and preview helpers for business file prompt injection.
 */

export const BUSINESS_FILE_PROMPT_CHAR_BUDGET = 12_000;

export const BUSINESS_FILE_PROMPT_INDEX_SAMPLE_LINES = 5;

export const BUSINESS_FILE_LOOKUP_INSTRUCTION =
  "Uploaded files: look up specific items with search_business_file during the call. Quote only what matches the caller's question — never read the whole document aloud.";

export const BUSINESS_FILE_PREVIEW_ITEM_COUNT = 10;

export type FileExtractionPreview = {
  items: string[];
  totalCount: number;
  summary: string;
};

export type FilePromptSlice = {
  text: string;
  wasTruncated: boolean;
  totalChars: number;
};

export function splitExtractedLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildFileExtractionPreview(
  extractedText: string | null | undefined,
): FileExtractionPreview | null {
  const raw = extractedText?.trim();
  if (!raw) return null;

  const lines = splitExtractedLines(raw);
  const items =
    lines.length > 0
      ? lines.slice(0, BUSINESS_FILE_PREVIEW_ITEM_COUNT)
      : raw
          .split(/\s{2,}/)
          .map((part) => part.trim())
          .filter(Boolean)
          .slice(0, BUSINESS_FILE_PREVIEW_ITEM_COUNT);

  const totalCount = lines.length > 0 ? lines.length : items.length;
  const summary =
    totalCount > BUSINESS_FILE_PREVIEW_ITEM_COUNT
      ? `${totalCount} lines read`
      : totalCount === 1
        ? "1 line read"
        : `${totalCount} lines read`;

  return { items, totalCount, summary };
}

export function buildLargeFilePromptIndex(
  extractedText: string,
  fileName: string,
  kindLabel: string,
  sampleLineCount = BUSINESS_FILE_PROMPT_INDEX_SAMPLE_LINES,
  metadata?: {
    title?: string | null;
    caraDescription?: string | null;
    whenToUse?: string | null;
  },
): string {
  const lines = splitExtractedLines(extractedText);
  const sample =
    lines.length > 0
      ? lines.slice(0, sampleLineCount).join("\n")
      : extractedText.trim().slice(0, 240);
  const lineLabel =
    lines.length === 1 ? "1 line" : `${lines.length} lines`;
  const displayName = metadata?.title?.trim() || fileName;

  const metaLines = [
    metadata?.caraDescription?.trim()
      ? `What it is: ${metadata.caraDescription.trim()}`
      : null,
    metadata?.whenToUse?.trim()
      ? `When to use: ${metadata.whenToUse.trim()}`
      : null,
  ].filter(Boolean);

  return [
    `${kindLabel} (${displayName}) — ${lineLabel}, ${extractedText.length.toLocaleString("en-IE")} characters total.`,
    ...metaLines,
    sample ? `Sample:\n${sample}` : null,
    "Use search_business_file to look up specific items from this file on the call.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildBusinessFileMetadataBlock(file: {
  title?: string | null;
  caraDescription?: string | null;
  whenToUse?: string | null;
}): string {
  const parts: string[] = [];
  if (file.caraDescription?.trim()) {
    parts.push(`What it is: ${file.caraDescription.trim()}`);
  }
  if (file.whenToUse?.trim()) {
    parts.push(`When to use: ${file.whenToUse.trim()}`);
  }
  return parts.join("\n");
}

export function sliceFileTextForPrompt(
  extractedText: string | null | undefined,
  budget = BUSINESS_FILE_PROMPT_CHAR_BUDGET,
): FilePromptSlice | null {
  const raw = extractedText?.trim();
  if (!raw) return null;

  if (raw.length <= budget) {
    return { text: raw, wasTruncated: false, totalChars: raw.length };
  }

  const truncated = `${raw.slice(0, budget).trimEnd()}…`;
  return {
    text: truncated,
    wasTruncated: true,
    totalChars: raw.length,
  };
}

const PII_EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PII_PHONE_PATTERN =
  /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/g;

export function extractedContentLooksLikePii(text: string): boolean {
  const emails = text.match(PII_EMAIL_PATTERN) ?? [];
  const phones = text.match(PII_PHONE_PATTERN) ?? [];
  return emails.length >= 3 || phones.length >= 5;
}
