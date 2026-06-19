/** Business knowledge files (Cara Setup + Routing send picker). */

export const BUSINESS_FILE_KINDS = [
  "price_list",
  "menu",
  "brochure",
  "stock_sheet",
  "service_sheet",
  "faq_document",
  "other",
] as const;

export type BusinessFileKind = (typeof BUSINESS_FILE_KINDS)[number];

export const BUSINESS_FILE_KIND_LABELS: Record<BusinessFileKind, string> = {
  price_list: "Price list",
  menu: "Menu",
  brochure: "Brochure",
  stock_sheet: "Stock sheet",
  service_sheet: "Service sheet",
  faq_document: "FAQ document",
  other: "Other document",
};

export function isBusinessFileKind(value: string): value is BusinessFileKind {
  return (BUSINESS_FILE_KINDS as readonly string[]).includes(value);
}

export function businessFileKindLabel(kind: string | null | undefined): string | null {
  if (!kind || !isBusinessFileKind(kind)) return null;
  return BUSINESS_FILE_KIND_LABELS[kind];
}

export const BUSINESS_FILES_BUCKET = "business-files";

export const MAX_BUSINESS_FILE_BYTES = 10 * 1024 * 1024;

export const BUSINESS_FILE_MIME_TYPES = [
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
] as const;

export type BusinessFileProcessingStatus =
  | "ready"
  | "processing"
  | "needs_processing";

export type BusinessFileRecord = {
  id: string;
  organizationId: string;
  fileName: string;
  fileType: string;
  mimeType: string | null;
  storagePath: string;
  sizeBytes: number | null;
  answerEnabled: boolean;
  sendEnabled: boolean;
  documentKind: string | null;
  title: string | null;
  caraDescription: string | null;
  whenToUse: string | null;
  processingStatus: BusinessFileProcessingStatus;
  extractedText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessFileListItem = Pick<
  BusinessFileRecord,
  | "id"
  | "fileName"
  | "fileType"
  | "mimeType"
  | "sizeBytes"
  | "answerEnabled"
  | "sendEnabled"
  | "documentKind"
  | "title"
  | "caraDescription"
  | "whenToUse"
  | "processingStatus"
  | "extractedText"
  | "createdAt"
>;

export function formatBusinessFileSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatBusinessFileDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fileSupportsAnswerToggle(file: {
  processingStatus: BusinessFileProcessingStatus;
  extractedText: string | null;
}): boolean {
  if (file.processingStatus === "processing") return false;
  if (file.processingStatus === "needs_processing") return false;
  return Boolean(file.extractedText?.trim());
}

export function inferFileType(
  fileName: string,
  mimeType: string | null,
): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (lower.endsWith(".csv") || mimeType === "text/csv") return "csv";
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mimeType?.includes("spreadsheet") ||
    mimeType?.includes("excel")
  ) {
    return "spreadsheet";
  }
  if (lower.endsWith(".txt") || mimeType === "text/plain") return "txt";
  return "other";
}

export function isSpreadsheetFileType(fileType: string): boolean {
  return fileType === "csv" || fileType === "spreadsheet";
}

export function defaultBusinessFileTitle(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  const cleaned = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || fileName;
}

export function businessFileDisplayTitle(file: {
  title?: string | null;
  fileName: string;
}): string {
  const title = file.title?.trim();
  return title || defaultBusinessFileTitle(file.fileName);
}

export function whenToUsePlaceholder(kind: BusinessFileKind | null): string {
  switch (kind) {
    case "price_list":
      return "When callers ask about prices or what's on the menu";
    case "menu":
      return "When callers ask what's available or about specific items";
    case "brochure":
      return "When callers want an overview of what you offer";
    case "stock_sheet":
      return "When callers ask about stock or availability";
    case "service_sheet":
      return "When callers ask about services or treatments in detail";
    case "faq_document":
      return "When callers ask common questions covered in this document";
    default:
      return "When callers ask about information in this document";
  }
}

export function caraDescriptionPlaceholder(kind: BusinessFileKind | null): string {
  switch (kind) {
    case "price_list":
      return "Our full price list with services and costs";
    case "menu":
      return "Our service or product menu";
    case "brochure":
      return "Overview brochure about the business";
    case "stock_sheet":
      return "Current stock or inventory list";
    case "service_sheet":
      return "Detailed service descriptions";
    case "faq_document":
      return "Answers to common customer questions";
    default:
      return "Business document for caller questions";
  }
}

export function mapBusinessFileRow(row: {
  id: string;
  organization_id: string;
  file_name: string;
  file_type: string;
  mime_type: string | null;
  storage_path: string;
  size_bytes: number | null;
  answer_enabled: boolean;
  send_enabled: boolean;
  document_kind: string | null;
  title?: string | null;
  cara_description?: string | null;
  when_to_use?: string | null;
  processing_status: string;
  extracted_text: string | null;
  created_at: string;
  updated_at: string;
}): BusinessFileRecord {
  const processingStatus =
    row.processing_status === "processing" ||
    row.processing_status === "needs_processing"
      ? row.processing_status
      : "ready";
  return {
    id: row.id,
    organizationId: row.organization_id,
    fileName: row.file_name,
    fileType: row.file_type,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    sizeBytes: row.size_bytes,
    answerEnabled: row.answer_enabled,
    sendEnabled: row.send_enabled,
    documentKind: row.document_kind,
    title: row.title ?? null,
    caraDescription: row.cara_description ?? null,
    whenToUse: row.when_to_use ?? null,
    processingStatus,
    extractedText: row.extracted_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toBusinessFileListItem(
  record: BusinessFileRecord,
): BusinessFileListItem {
  return {
    id: record.id,
    fileName: record.fileName,
    fileType: record.fileType,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    answerEnabled: record.answerEnabled,
    sendEnabled: record.sendEnabled,
    documentKind: record.documentKind,
    title: record.title,
    caraDescription: record.caraDescription,
    whenToUse: record.whenToUse,
    processingStatus: record.processingStatus,
    extractedText: record.extractedText,
    createdAt: record.createdAt,
  };
}
