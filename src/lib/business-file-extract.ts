import { inferFileType } from "@/lib/business-files";

const MAX_EXTRACTED_CHARS = 120_000;

/**
 * MVP text extraction: CSV and plain text only.
 * PDF / XLSX return null (honest `needs_processing` in DB).
 */
export function extractBusinessFileText(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): { text: string | null; processingStatus: "ready" | "needs_processing" } {
  const fileType = inferFileType(fileName, mimeType);

  if (fileType === "txt" || fileType === "csv") {
    const raw = buffer.toString("utf8").replace(/\u0000/g, "");
    const trimmed = raw.trim().slice(0, MAX_EXTRACTED_CHARS);
    if (!trimmed) {
      return { text: null, processingStatus: "needs_processing" };
    }
    return { text: trimmed, processingStatus: "ready" };
  }

  if (fileType === "pdf" || fileType === "spreadsheet") {
    return { text: null, processingStatus: "needs_processing" };
  }

  return { text: null, processingStatus: "needs_processing" };
}
