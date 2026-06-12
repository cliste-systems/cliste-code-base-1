export type CaraStarterNotesInput = {
  businessName: string;
  businessType?: string | null;
  address?: string | null;
  eircode?: string | null;
  serviceArea?: string | null;
};

/** Used in Cara's training notes (after the owner confirms their business). */
export const CARA_TRAINING_CAPTURE_LINE =
  "I should collect the caller's name, phone number, location, issue, urgency, and preferred callback time.";

/** Fix legacy third-person lines when loading saved training notes. */
export function normalizeCaraTrainingVoice(text: string): string {
  return text
    .replace(/\bCara should\b/gi, "I should")
    .replace(/\bThey handle\b/g, "I handle")
    .replace(/\bThey should\b/gi, "I should");
}

export function formatBusinessLocation(
  address: string | null | undefined,
  eircode?: string | null,
): string {
  const trimmed = address?.trim();
  if (!trimmed && !eircode?.trim()) return "";

  if (trimmed) {
    const parts = trimmed
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      const countyLike = (part: string) => /^co\.?\s/i.test(part);
      if (countyLike(parts[parts.length - 1]!) && parts.length >= 2) {
        return parts[parts.length - 2]!.trim();
      }
      return parts[parts.length - 1]!.replace(/^co\.?\s*/i, "").trim();
    }
    return parts[0]!;
  }

  return eircode?.trim() ?? "";
}

/** How the business is described in the step-1 opener (company, not sole-trader trade label). */
export function describeBusinessKind(businessType: string): string {
  const raw = businessType.trim();
  if (!raw || raw.toLowerCase() === "local") return "local business";

  const lower = raw.toLowerCase();

  if (lower.includes("plumb")) return "plumbing company";
  if (lower.includes("electric")) return "electrical company";
  if (lower.includes("heat")) return "heating company";
  if (/\b(hairdress|hair salon|hair stylist|hairstylist)\b/i.test(raw)) {
    return "hair salon";
  }
  if (/\bbarber\b/i.test(raw)) return "barber shop";
  if (/\bsalon\b/i.test(raw)) return "hair salon";
  if (lower.includes("landscap")) return "landscaping company";
  if (lower.includes("paint")) return "painting company";
  if (lower.includes("roof")) return "roofing company";
  if (lower.includes("clean")) return "cleaning company";
  if (lower.includes("build") || lower.includes("construct")) return "construction company";

  if (
    /\b(clinic|salon|studio|practice|centre|center|company|firm|agency|shop|store)\b/i.test(
      raw,
    )
  ) {
    return lower;
  }

  return `${lower} company`;
}

/** Short one-line opener for the structured know form (not the full starter draft). */
export function buildBusinessOpener(input: CaraStarterNotesInput): string {
  const businessName = input.businessName.trim() || "This business";
  const businessType = input.businessType?.trim() || "local";
  const businessKind = describeBusinessKind(businessType);
  const location = formatBusinessLocation(input.address, input.eircode);

  if (location) {
    return `${businessName} is a ${businessKind} based in ${location}.`;
  }
  return `${businessName} is a ${businessKind}.`;
}
