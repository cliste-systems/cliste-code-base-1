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
    processingStatus: record.processingStatus,
    extractedText: record.extractedText,
    createdAt: record.createdAt,
  };
}
