export const CALL_RECORDINGS_BUCKET = "call-recordings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Private object path: `{organizationId}/{callLogId}.mp3` */
export function callRecordingStoragePath(
  organizationId: string,
  callLogId: string,
  extension: "mp3" | "mp4" | "m4a" = "mp3",
): string {
  const org = organizationId.trim();
  const call = callLogId.trim();
  if (!UUID_RE.test(org) || !UUID_RE.test(call)) {
    throw new Error("Invalid call recording path identifiers");
  }
  return `${org}/${call}.${extension}`;
}

export function isValidCallRecordingStoragePath(
  storagePath: string,
  organizationId: string,
): boolean {
  const path = storagePath.trim();
  const org = organizationId.trim();
  if (!path || !org) return false;
  const match = path.match(
    /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(mp3|mp4|m4a)$/i,
  );
  if (!match) return false;
  return match[1]?.toLowerCase() === org.toLowerCase();
}

export function callRecordingContentType(storagePath: string): string {
  const lower = storagePath.trim().toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "audio/mp4";
}
