export function parseReviewChipList(
  text: string,
  { stripNegation = false }: { stripNegation?: boolean } = {},
): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of text.split(/[\n,;]+/)) {
    let item = raw.trim().replace(/^[-•*]\s*/, "");
    if (!item) continue;

    if (stripNegation) {
      item = item
        .replace(/^we don'?t\s+(?:do|offer|handle|cover)\s+/i, "")
        .replace(/^we don'?t\s+/i, "")
        .replace(/^no\s+/i, "")
        .replace(/^not\s+/i, "")
        .trim();
      if (item) {
        item = item.charAt(0).toUpperCase() + item.slice(1);
      }
    }

    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return items;
}

export function buildReviewRules(rules: string[]): string[] {
  const cleaned = rules.map((rule) => rule.trim()).filter(Boolean);
  const seen = new Set<string>();

  return cleaned.filter((rule) => {
    const key = rule.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

