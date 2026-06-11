/** First name for greetings when profile name differs from the business name. */
export function getProfileFirstName(
  profileName: string,
  businessName: string,
): string | null {
  const profile = profileName.trim();
  const business = businessName.trim();
  if (!profile || profile.toLowerCase() === business.toLowerCase()) {
    return null;
  }

  const first = profile.split(/\s+/)[0]?.trim();
  return first && first.length >= 1 ? first : null;
}

export function ownerNameNeedsCapture(
  profileName: string,
  businessName: string,
): boolean {
  return getProfileFirstName(profileName, businessName) === null;
}

export function splitOwnerName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function joinOwnerName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}
