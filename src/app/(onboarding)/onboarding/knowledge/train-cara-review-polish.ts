/** Turn rough owner notes into natural English for Cara's review read-back. */

function stripTrailingPunctuation(text: string): string {
  return text.trim().replace(/[.!?,;:]+$/, "").trim();
}

function ensureSentence(text: string): string {
  const trimmed = stripTrailingPunctuation(text);
  if (!trimmed) return "";
  const lead = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(lead) ? lead : `${lead}.`;
}

function looksLikeProperSentence(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 24) return false;
  if (!/^[A-Z("'"]/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/).length;
  const commas = (trimmed.match(/,/g) ?? []).length;
  if (commas > 0 && words / (commas + 1) < 5) return false;

  return words >= 8 || /[.!?]$/.test(trimmed);
}

function polishAnswerFragment(fragment: string): string {
  const trimmed = stripTrailingPunctuation(fragment);
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();

  if (/^yes[, ]+we do$/i.test(lower) || lower === "yes we do") {
    return "Yes, we do";
  }
  if (/^no[, ]+we don'?t$/i.test(lower) || lower === "no we dont" || lower === "no we don't") {
    return "No, we don't";
  }
  if (/^(yes|yeah|yep)$/i.test(lower)) return "Yes";
  if (/^(no|nope)$/i.test(lower)) return "No";

  if (/^ring\s+(their\s+|a\s+|the\s+)?number$/i.test(lower)) {
    return "take their number";
  }
  if (/^take\s+(their\s+|a\s+|the\s+)?number$/i.test(lower)) {
    return "take their number";
  }
  if (/^get\s+(their\s+|a\s+|the\s+)?number$/i.test(lower)) {
    return "get their number";
  }
  if (/^transfer\s+(the\s+call\s+)?to\s+me$/i.test(lower)) {
    return "transfer the call to you";
  }
  if (/^transfer\s+(it\s+)?to\s+me$/i.test(lower)) {
    return "transfer the call to you";
  }
  if (/^put\s+(them\s+)?through\s+to\s+me$/i.test(lower)) {
    return "put them through to you";
  }
  if (/^call\s+(them\s+)?back$/i.test(lower)) {
    return "arrange a callback";
  }
  if (/^callback$/i.test(lower)) {
    return "arrange a callback";
  }
  if (/^book\s+(it\s+)?in$/i.test(lower)) {
    return "book it in";
  }
  if (/^check\s+(the\s+)?area$/i.test(lower)) {
    return "check they're in your area";
  }

  const lead = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return stripTrailingPunctuation(lead);
}

function isActionFragment(fragment: string): boolean {
  const lower = fragment.toLowerCase();
  return (
    /^(take|get|transfer|put|call|book|check|ask|find|arrange|collect|confirm|note|capture)\b/.test(
      lower,
    ) || lower.startsWith("i'll ")
  );
}

function joinPolishedFragments(fragments: string[]): string {
  if (fragments.length === 0) return "";
  if (fragments.length === 1) return ensureSentence(fragments[0]!);

  const statements = fragments.filter((part) => !isActionFragment(part));
  const actions = fragments.filter((part) => isActionFragment(part));

  const parts: string[] = [];

  if (statements.length > 0) {
    parts.push(ensureSentence(statements.join(", ")));
  }

  if (actions.length > 0) {
    const normalizedActions = actions.map((action) =>
      action.replace(/^i'll\s+/i, "").trim(),
    );
    parts.push(
      ensureSentence(`I'll ${joinClauses(normalizedActions)}`),
    );
  }

  return parts.join(" ");
}

function joinClauses(clauses: string[]): string {
  const cleaned = clauses.map((clause) => stripTrailingPunctuation(clause)).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0]!;
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

export function polishFaqAnswer(raw: string): string {
  const text = raw.trim();
  if (!text) return "";

  if (looksLikeProperSentence(text)) {
    return ensureSentence(text);
  }

  const fragments = text
    .split(/[,;]+|\s+then\s+/i)
    .map((part) => polishAnswerFragment(part))
    .filter(Boolean);

  if (fragments.length <= 1) {
    const single = fragments[0] ?? polishAnswerFragment(text);
    if (isActionFragment(single)) {
      return ensureSentence(`I'll ${single.replace(/^i'll\s+/i, "")}`);
    }
    return ensureSentence(single);
  }

  return joinPolishedFragments(fragments);
}

export function buildFaqReviewLine(question: string, answer: string): string {
  const q = stripTrailingPunctuation(question);
  const polished = polishFaqAnswer(answer);
  if (!q) return polished;
  if (!polished) {
    return `If someone asks "${q}", I'll check with you before guessing.`;
  }
  return `If someone asks "${q}", I'll say: ${polished}`;
}
