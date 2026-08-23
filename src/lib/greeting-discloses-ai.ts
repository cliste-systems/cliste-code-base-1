import { voiceLegalDisclosure } from "@/lib/voice-greeting";

/** Whether a greeting explicitly discloses AI assistance for the named business. */
export function greetingDisclosesAi(
  greeting: string,
  assistantDisplayName = "Cara",
): boolean {
  const trimmed = greeting.trim();
  if (!trimmed) return false;

  const legal = voiceLegalDisclosure(assistantDisplayName);
  if (trimmed.includes(legal)) return true;

  const lower = trimmed.toLowerCase();
  const name = assistantDisplayName.trim().toLowerCase() || "cara";
  const hasAiDisclosure =
    /\b(ai assistant|virtual assistant|automated assistant|artificial intelligence)\b/i.test(
      lower,
    );
  const namesAssistant = lower.includes(name) || lower.includes("cara");
  const mentionsRecording =
    /\b(recorded|transcribed|recording|transcript)\b/i.test(lower);

  return hasAiDisclosure && namesAssistant && mentionsRecording;
}
