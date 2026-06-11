/**
 * Deterministic routing for plain-English Cara instructions (no niche vocabulary).
 */

export type TemporaryUnavailabilityRule = {
  rule: string;
  servicePhrase: string;
  untilPhrase: string;
};

/**
 * Detects temporary booking pauses and routes them to business rules — not service
 * chip deletion and not exclusions.
 */
export function tryParseTemporaryUnavailabilityRule(
  instruction: string,
): TemporaryUnavailabilityRule | null {
  const text = instruction.trim();
  if (text.length < 8) return null;

  const patterns: RegExp[] = [
    /\b(?:tell\s+cara\s+)?(?:we(?:'re| are)\s+)?not\s+taking\s+(.+?)\s+(?:bookings?|appointments?|jobs?|requests?)\s+(?:until|before|for)\s+(.+?)\.?$/i,
    /\bnot\s+taking\s+(.+?)\s+(?:bookings?|appointments?|jobs?|requests?)\s+(?:until|before|for)\s+(.+?)\.?$/i,
    /\b(?:pause|stop|hold)\s+(.+?)\s+(?:bookings?|appointments?|jobs?)\s+(?:until|before|for)\s+(.+?)\.?$/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const servicePhrase = match[1]?.trim();
    const untilPhrase = match[2]?.trim();
    if (!servicePhrase || !untilPhrase) continue;

    return {
      servicePhrase,
      untilPhrase,
      rule: `Do not book ${servicePhrase} until ${untilPhrase}. If callers ask to book sooner, explain briefly and take their details for the team.`,
    };
  }

  return null;
}
