export const PROFILE_AVATARS_BUCKET = "profile-avatars";

export const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const PROFILE_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type ProfileAvatarMimeType = (typeof PROFILE_AVATAR_MIME_TYPES)[number];

export const PROFILE_AVATAR_OUTPUT_SIZE = 512;

/** File-picker accept string — includes HEIC so macOS Photos allows Open. */
export const PROFILE_AVATAR_FILE_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

export function profileAvatarStoragePath(userId: string): string {
  return `${userId}/avatar.webp`;
}

export function isProfileAvatarMimeType(
  mime: string,
): mime is ProfileAvatarMimeType {
  return PROFILE_AVATAR_MIME_TYPES.includes(
    mime.toLowerCase() as ProfileAvatarMimeType,
  );
}

/** Server actions may receive a bound `File` or a `FormData` entry (File/Blob). */
export function normalizeProfileAvatarFile(
  file: File | Blob | FormDataEntryValue | null | undefined,
): File | null {
  if (!file || typeof file !== "object" || !("size" in file) || file.size <= 0) {
    return null;
  }
  if (file instanceof File) return file;
  if (file instanceof Blob) {
    return new File([file], "avatar.webp", {
      type: file.type || "image/webp",
    });
  }
  return null;
}

export function profileAvatarPublicUrl(
  supabaseUrl: string,
  userId: string,
  version?: number,
): string {
  const base = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${PROFILE_AVATARS_BUCKET}/${profileAvatarStoragePath(userId)}`;
  if (version == null) return base;
  return `${base}?v=${version}`;
}
