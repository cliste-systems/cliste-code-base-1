/**
 * Strips Markdown-style emphasis so Cara bubbles stay plain, readable text.
 * Handles nested `**…**` / `__…__` from model output.
 */
export function stripChatMarkdownDisplay(text: string): string {
  let s = text;
  for (let i = 0; i < 8; i += 1) {
    const next = s
      .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
      .replace(/__([\s\S]+?)__/g, "$1");
    if (next === s) break;
    s = next;
  }
  return s;
}
