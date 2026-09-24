import "server-only";

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "txt",
  "csv",
  "docx",
  "xlsx",
]);

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type AdminAttachmentScanStatus =
  | "pending"
  | "clean"
  | "infected"
  | "failed"
  | "unsupported";

export type AdminAttachmentSafetyInput = {
  filename: string;
  contentType: string | null | undefined;
  sizeBytes: number | null | undefined;
  scanStatus: AdminAttachmentScanStatus | null | undefined;
};

function extension(filename: string): string {
  const value = filename.trim().toLowerCase();
  const index = value.lastIndexOf(".");
  return index >= 0 ? value.slice(index + 1) : "";
}

export function attachmentPolicyAllowsType(
  input: Pick<AdminAttachmentSafetyInput, "filename" | "contentType" | "sizeBytes">,
): boolean {
  const type = input.contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const ext = extension(input.filename);
  const size = input.sizeBytes ?? 0;

  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) return false;
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(type)) return false;
  if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) {
    return false;
  }
  return true;
}

/**
 * Fail closed: an attachment can only be opened after BOTH the static file
 * policy passes and a malware scanner has explicitly recorded "clean".
 */
export function attachmentMayBeOpened(input: AdminAttachmentSafetyInput): boolean {
  return (
    attachmentPolicyAllowsType(input) &&
    input.scanStatus === "clean"
  );
}

export function assertAttachmentMayBeOpened(
  input: AdminAttachmentSafetyInput,
): void {
  if (!attachmentPolicyAllowsType(input)) {
    throw new Error("This attachment type or size is not permitted.");
  }
  if (input.scanStatus !== "clean") {
    throw new Error("This attachment has not passed malware scanning.");
  }
}
