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

export function buildReviewBusinessLine(input: {
  businessType: string;
  about: string;
  serviceArea: string;
}): string {
  const type = input.businessType.trim();
  const area = input.serviceArea.trim();
  const areaLooksLikeSentence =
    area.length > 48 || /^(we cover|covering|areas? covered)/i.test(area);

  if (type && area && !areaLooksLikeSentence) return `${type} across ${area}`;
  if (type) return type;
  if (area) return `Service area: ${area}`;

  const firstLine = input.about.trim().split(/\n+/)[0]?.trim() ?? "";
  if (firstLine) {
    const shortened =
      firstLine.length > 96 ? `${firstLine.slice(0, 93).trim()}…` : firstLine;
    return shortened;
  }

  return "Your business";
}

export function buildReviewEmergencyLine(input: {
  about: string;
  servicesOffered: string;
  openingHours: string;
}): string | null {
  const blob = `${input.about} ${input.servicesOffered} ${input.openingHours}`;
  const lower = blob.toLowerCase();

  if (!/emergency|callout|outside hours|after hours|24\s*\/\s*7|urgent/i.test(lower)) {
    return null;
  }

  if (/outside hours|after hours|24\s*\/\s*7|weekend/i.test(lower)) {
    return "Available outside hours";
  }

  return "Emergency callouts available";
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

/** Readable inline list — avoids chip-wall clutter on review. */
export function formatReviewInlineList(items: string[]): string {
  return items.join(" · ");
}
