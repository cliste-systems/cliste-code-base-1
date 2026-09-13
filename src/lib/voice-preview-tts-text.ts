/**
 * Minimal TTS prep for dashboard voice previews — mirrors code-base-2
 * pronunciation rules so the preview matches live calls.
 */
const PRONUNCIATION_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\bHello Cara\b/gi, "Hello Kara"],
  [/\bCara\b/g, "Kara"],
  [/\bKavanaghs\b/gi, "Kavanahs"],
  [/\bDonegal Town\b/gi, "Doneygall Town"],
  [/\bDonegal\b/gi, "Doneygall"],
];

export function prepareVoicePreviewTtsText(text: string): string {
  let out = text.trim();
  for (const [pattern, replacement] of PRONUNCIATION_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
