export type CaraAnswerLength = "short" | "normal";
export type CaraLinkDelivery = "text" | "spell_out";
export type CaraTone = "casual" | "professional";

export type CaraConduct = {
  useFirstName: boolean;
  answerLength: CaraAnswerLength;
  linkDelivery: CaraLinkDelivery;
  tone: CaraTone;
  /** Optional capped style note — denylist-filtered at save. */
  additionalNote?: string;
};

export const MAX_CARA_CONDUCT_NOTE_LENGTH = 200;

export const DEFAULT_CARA_CONDUCT: CaraConduct = {
  useFirstName: true,
  answerLength: "normal",
  linkDelivery: "text",
  tone: "professional",
};

export function parseCaraConduct(value: unknown): CaraConduct {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_CARA_CONDUCT };
  }
  const row = value as Record<string, unknown>;
  const additionalNote = String(row.additionalNote ?? "").trim();
  return {
    useFirstName: row.useFirstName !== false,
    answerLength: row.answerLength === "short" ? "short" : "normal",
    linkDelivery: row.linkDelivery === "spell_out" ? "spell_out" : "text",
    tone: row.tone === "casual" ? "casual" : "professional",
    additionalNote: additionalNote
      ? additionalNote.slice(0, MAX_CARA_CONDUCT_NOTE_LENGTH)
      : undefined,
  };
}

/** Best-effort map legacy free-text cara rules into structured conduct. */
export function inferCaraConductFromLegacyRules(
  rules: string[],
  existing?: CaraConduct | null,
): CaraConduct {
  const conduct: CaraConduct = {
    ...(existing ?? DEFAULT_CARA_CONDUCT),
  };
  const unmatched: string[] = [];

  for (const raw of rules) {
    const rule = raw.trim();
    if (!rule) continue;
    const lower = rule.toLowerCase();

    if (/\b(?:first\s+name|call(?:ers)?\s+by\s+name)\b/i.test(rule)) {
      conduct.useFirstName = !/\b(?:don'?t|never|not)\b/i.test(rule);
      continue;
    }
    if (/\b(?:short|brief|concise)\b/i.test(rule) && /\banswer/i.test(rule)) {
      conduct.answerLength = "short";
      continue;
    }
    if (/\b(?:spell\s+out|read\s+out)\b/i.test(rule) && /\blink/i.test(rule)) {
      conduct.linkDelivery = "spell_out";
      continue;
    }
    if (/\b(?:casual|friendly|informal)\b/i.test(rule)) {
      conduct.tone = "casual";
      continue;
    }
    if (/\b(?:formal|professional)\b/i.test(rule)) {
      conduct.tone = "professional";
      continue;
    }
    unmatched.push(rule);
  }

  if (unmatched.length > 0 && !conduct.additionalNote) {
    conduct.additionalNote = unmatched
      .join("; ")
      .slice(0, MAX_CARA_CONDUCT_NOTE_LENGTH);
  }

  return conduct;
}

export function caraConductSection(conduct: CaraConduct): string {
  const lines: string[] = ["How I should handle your calls:"];

  if (conduct.useFirstName) {
    lines.push("• I use the caller's first name when I have it.");
  } else {
    lines.push("• I don't use first names unless they ask me to.");
  }

  if (conduct.answerLength === "short") {
    lines.push("• I keep answers short — one or two sentences unless they need more.");
  } else {
    lines.push("• I'm concise but I'll give a fuller answer when the question needs it.");
  }

  if (conduct.linkDelivery === "spell_out") {
    lines.push(
      "• When sharing a link verbally, I spell out the URL clearly instead of only offering to text it.",
    );
  } else {
    lines.push(
      "• When a link is available, I offer to text it to their mobile rather than spelling out long URLs.",
    );
  }

  if (conduct.tone === "casual") {
    lines.push("• My tone is warm and casual while staying professional.");
  } else {
    lines.push("• My tone is warm and professional.");
  }

  const note = conduct.additionalNote?.trim();
  if (note) {
    lines.push(`• ${note}`);
  }

  return lines.join("\n");
}
