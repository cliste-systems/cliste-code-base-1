export function ownerInitiatedTeachMetadata(input: {
  ownerDescription: string;
  temporalTitle?: string | null;
}): { gapSummary: string; caraQuestion: string } {
  const description = input.ownerDescription.trim();
  const firstSentence =
    description.split(/[.!?\n]/)[0]?.trim() || description;
  const gapSummary = (
    input.temporalTitle?.trim() ||
    firstSentence ||
    description
  ).slice(0, 200);

  return {
    gapSummary,
    caraQuestion: description,
  };
}
