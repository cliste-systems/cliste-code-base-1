const BUSINESS_FILE_BASE_SELECT =
  "id, organization_id, file_name, file_type, mime_type, storage_path, size_bytes, answer_enabled, send_enabled, document_kind, processing_status, extracted_text, created_at, updated_at";

export const BUSINESS_FILE_SELECT_LEGACY = BUSINESS_FILE_BASE_SELECT;

export const BUSINESS_FILE_SELECT =
  `${BUSINESS_FILE_BASE_SELECT}, title, cara_description, when_to_use`;

export const BUSINESS_FILE_SEARCH_SELECT =
  "id, file_name, document_kind, title, cara_description, when_to_use, answer_enabled, processing_status, extracted_text";

export const BUSINESS_FILE_SEARCH_SELECT_LEGACY =
  "id, file_name, document_kind, answer_enabled, processing_status, extracted_text";

/** Cached after first query — avoids repeated failed selects before migration 081. */
let metadataColumnsAvailable: boolean | null = null;

export function isMissingBusinessFileMetadataColumnError(
  message: string | undefined,
): boolean {
  return Boolean(
    message?.includes("title") ||
      message?.includes("cara_description") ||
      message?.includes("when_to_use"),
  );
}

export function businessFileSelectColumns(): string {
  return metadataColumnsAvailable === false
    ? BUSINESS_FILE_SELECT_LEGACY
    : BUSINESS_FILE_SELECT;
}

export function businessFileSearchSelectColumns(): string {
  return metadataColumnsAvailable === false
    ? BUSINESS_FILE_SEARCH_SELECT_LEGACY
    : BUSINESS_FILE_SEARCH_SELECT;
}

export function markBusinessFileMetadataColumnsUnavailable(): void {
  metadataColumnsAvailable = false;
}

export function markBusinessFileMetadataColumnsAvailable(): void {
  metadataColumnsAvailable = true;
}

export function businessFileMetadataColumnsAvailable(): boolean | null {
  return metadataColumnsAvailable;
}
