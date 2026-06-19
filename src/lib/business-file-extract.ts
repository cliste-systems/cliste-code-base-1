import { extractText, getDocumentProxy } from "unpdf";

import { inferFileType } from "@/lib/business-files";

const MAX_EXTRACTED_CHARS = 120_000;

export function normalizeExtractedBusinessFileText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const normalized = normalizeExtractedBusinessFileText(
      typeof text === "string" ? text : String(text ?? ""),
    );
    return normalized || null;
  } catch (err) {
    console.warn("[business-file-extract] PDF extract failed", err);
    return null;
  }
}

export async function extractBusinessFileText(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ text: string | null; processingStatus: "ready" | "needs_processing" }> {
  const fileType = inferFileType(fileName, mimeType);

  if (fileType === "txt" || fileType === "csv") {
    const raw = buffer.toString("utf8").replace(/\u0000/g, "");
    const trimmed = normalizeExtractedBusinessFileText(raw);
    if (!trimmed) {
      return { text: null, processingStatus: "needs_processing" };
    }
    return { text: trimmed, processingStatus: "ready" };
  }

  if (fileType === "pdf") {
    const text = await extractPdfText(buffer);
    if (!text) {
      return { text: null, processingStatus: "needs_processing" };
    }
    return { text, processingStatus: "ready" };
  }

  if (fileType === "spreadsheet") {
    return { text: null, processingStatus: "needs_processing" };
  }

  return { text: null, processingStatus: "needs_processing" };
}
