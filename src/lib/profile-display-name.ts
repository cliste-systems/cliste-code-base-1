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

export function joinOwnerName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}
