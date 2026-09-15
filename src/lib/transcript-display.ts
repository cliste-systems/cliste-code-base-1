/** Staff-facing transcript cleanup — hide internal tool RPC from readable conversation. */

const TOOL_BLOCK_RE = /^\[Tool/i;
const SPEAKER_LINE_RE = /^(Assistant|Caller):\s*(.*)$/i;

export type TranscriptTurn = {
  speaker: "Assistant" | "Caller" | null;
  text: string;
};

/** Remove [Tool], [Tool result], and [Tool error] blocks from a stored transcript. */
export function stripToolLinesFromTranscript(
  text: string | null | undefined,
): string {
  const raw = String(text ?? "").trim();
  if (!raw) return "";

  return raw
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !TOOL_BLOCK_RE.test(block))
    .join("\n\n")
    .trim();
}

/** Split a staff transcript into speaker turns for spaced UI rendering. */
export function parseTranscriptTurns(text: string | null | undefined): TranscriptTurn[] {
  const normalized = String(text ?? "").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const turns: TranscriptTurn[] = [];
  let current: TranscriptTurn | null = null;

  for (const line of lines) {
    const match = line.match(SPEAKER_LINE_RE);
    if (match) {
      if (current) turns.push(current);
      const speaker = match[1].toLowerCase() === "caller" ? "Caller" : "Assistant";
      current = { speaker, text: match[2] ?? "" };
      continue;
    }

    if (current) {
      current.text = current.text ? `${current.text}\n${line}` : line;
      continue;
    }

    if (line.trim()) {
      turns.push({ speaker: null, text: line });
    }
  }

  if (current) turns.push(current);

  return turns.filter((turn) => turn.text.trim().length > 0);
}
