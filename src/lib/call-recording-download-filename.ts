const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

function sanitizeFilenameSegment(value: string, maxLength = 40): string {
  return value
    .trim()
    .replace(INVALID_FILENAME_CHARS, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}

export function normalizeCallerNumberForFilename(callerNumber: string): string {
  const trimmed = callerNumber.trim();
  if (!trimmed) return "unknown-caller";

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly) return digitsOnly;

  return sanitizeFilenameSegment(trimmed, 24) || "unknown-caller";
}

export function formatCallRecordingTimestamp(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "unknown-date";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}_${hours}${minutes}`;
}

export function callRecordingDownloadFilename(input: {
  createdAt: string;
  callerNumber: string;
  callerName?: string | null;
}): string {
  const parts = ["hellocara", formatCallRecordingTimestamp(input.createdAt)];

  const callerName = input.callerName?.trim();
  if (callerName && !/^unknown$/i.test(callerName)) {
    const segment = sanitizeFilenameSegment(callerName, 24);
    if (segment) parts.push(segment);
  }

  parts.push(normalizeCallerNumberForFilename(input.callerNumber));

  return `${parts.join("_")}.mp3`;
}
