const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSION = /\.(heic|heif)$/i;

export function isHeicImage(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (HEIC_MIME_TYPES.has(mime)) return true;
  return HEIC_EXTENSION.test(file.name);
}

export async function prepareProfileImageFile(file: File): Promise<File> {
  if (!isHeicImage(file)) return file;

  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });

  const blob = Array.isArray(converted) ? converted[0] : converted;
  const baseName = file.name.replace(HEIC_EXTENSION, "") || "photo";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}
