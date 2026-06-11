/** Inline hints when owners repeat behaviour Cara already follows on every call. */

export type RouteFieldHint = {
  id: string;
  field: "description" | "rules";
  message: string;
};

type RedundantPattern = {
  field: "description" | "rules" | "both";
  test: (text: string) => boolean;
  message: string;
};

function buildRedundantPatterns(fieldHintExample: string): RedundantPattern[] {
  return [
  {
    field: "both",
    test: (t) =>
      /confirm.*\b(mobile|cell|phone|number)\b/i.test(t) ||
      /\b(mobile|cell|phone)\b.*\bconfirm/i.test(t) ||
      /\bcheck\b.*\b(mobile|cell)\b/i.test(t),
    message:
      "Cara already confirms it's a mobile number before texting — remove that here.",
  },
  {
    field: "both",
    test: (t) =>
      /\b(ask|confirm)\b.*\bbefore\b.*\b(send|text|texting|sms)\b/i.test(t) ||
      /\bbefore\b.*\b(send|text|texting)\b.*\b(ask|confirm)\b/i.test(t),
    message:
      "Cara already asks before sending a link or file — skip that here.",
  },
  {
    field: "both",
    test: (t) =>
      /\bshall i send\b/i.test(t) ||
      /\bnumber you(?:'re| are) calling from\b/i.test(t),
    message:
      "Cara already offers to text the number they're calling from.",
  },
  {
    field: "both",
    test: (t) =>
      /\bcapture\b.*\b(name|phone|number)\b/i.test(t) &&
      /\bwhat they need\b/i.test(t),
    message:
      "Cara already captures name, number, and what they need for messages.",
  },
  {
    field: "both",
    test: (t) =>
      /\b(ai|recorded|recording)\b.*\b(disclos|say|tell)\b/i.test(t) ||
      /\b(disclos|say|tell)\b.*\b(recorded|recording)\b/i.test(t),
    message:
      "Cara always gives the AI and recording disclosure at the start of every call.",
  },
  {
    field: "both",
    test: (t) =>
      /\bresend\b/i.test(t) ||
      /\bdidn'?t receive\b/i.test(t) ||
      /\breceive the text\b/i.test(t),
    message:
      "Cara already resends once if a text didn't arrive.",
  },
  {
    field: "both",
    test: (t) => /\blandline\b/i.test(t),
    message:
      "Cara already handles landlines — she takes a message if SMS won't work.",
  },
  {
    field: "description",
    test: (t) =>
      /\btext\b.*\b(link|booking)\b.*\bwhen\b.*\b(book|schedule)\b/i.test(t) ||
      /\bwhen\b.*\b(book|schedule)\b.*\btext\b/i.test(t) ||
      /\bsend\b.*\b(link|booking)\b.*\bwhen\b/i.test(t),
    message: `That's what the route action already does — say when this route applies (e.g. ${fieldHintExample}).`,
  },
  {
    field: "rules",
    test: (t) =>
      /\bsent\b.*\bnow\b/i.test(t) ||
      /\blet them know\b.*\b(sent|text)\b/i.test(t),
    message: "Cara already confirms when a text has been sent.",
  },
];
}

export function findRedundantRouteFieldHints(
  description: string,
  rules: string,
  fieldHintExample = "service type vs general enquiry",
): RouteFieldHint[] {
  const hints: RouteFieldHint[] = [];
  const desc = description.trim();
  const note = rules.trim();

  for (const pattern of buildRedundantPatterns(fieldHintExample)) {
    const targets: Array<{ field: "description" | "rules"; text: string }> = [];
    if (pattern.field === "both" || pattern.field === "description") {
      if (desc) targets.push({ field: "description", text: desc });
    }
    if (pattern.field === "both" || pattern.field === "rules") {
      if (note) targets.push({ field: "rules", text: note });
    }

    for (const { field, text } of targets) {
      if (!pattern.test(text)) continue;
      const id = `${field}-${pattern.message.slice(0, 24)}`;
      if (hints.some((h) => h.id === id)) continue;
      hints.push({ id, field, message: pattern.message });
    }
  }

  return hints;
}

export const CARA_ALREADY_ON_CALL_COPY =
  "Cara already confirms mobiles, asks before texting, and captures name & number for messages.";
