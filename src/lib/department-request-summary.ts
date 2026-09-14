import { stripDemoRehearsalMarker } from "@/lib/dashboard-mock-cleanup";
import { stripRouteSuffixFromSummary } from "@/lib/retail-department-pack";

export type StructuredCaptureField = {
  label: string;
  value: string;
  unconfirmed: boolean;
};

export type StructuredCaptureSummary = {
  header: string;
  fields: StructuredCaptureField[];
};

export function parseStructuredCaptureSummary(
  summary: string | null | undefined,
): StructuredCaptureSummary | null {
  const lines = String(summary ?? "")
    .split(/\r?\n/)
    .map((line) =>
      stripDemoRehearsalMarker(stripRouteSuffixFromSummary(line.trim())),
    )
    .filter(Boolean);
  if (lines.length < 2) return null;

  const header = lines[0]!;
  const fields: StructuredCaptureField[] = [];

  for (const line of lines.slice(1)) {
    const match = line.match(/^([^:]+):\s*(.+)\s*$/i);
    if (!match) continue;
    const label = match[1]!.trim();
    const valueRaw = match[2]!.trim();
    const unconfirmed = /\(UNCONFIRMED\)/i.test(valueRaw);
    const value = valueRaw.replace(/\s*\(UNCONFIRMED\)\s*/gi, "").trim();
    if (!label || !value) continue;
    fields.push({ label, value, unconfirmed });
  }

  if (fields.length === 0) return null;
  return { header, fields };
}

function cleanSummary(summary: string | null | undefined): string {
  return stripDemoRehearsalMarker(
    stripRouteSuffixFromSummary(String(summary ?? "")),
  ).trim();
}

function field(label: string, value: string, unconfirmed = false): StructuredCaptureField {
  return { label, value: value.trim(), unconfirmed };
}

function looksLikeCakeOrder(text: string): boolean {
  return /\b(birthday cake|cake order|celebration cake|\bcake orders?\b)/i.test(
    text,
  );
}

function looksLikeButcherRequest(text: string): boolean {
  return /\b(butcher|meat counter|steak|sirloin|striploin|rashers|sausage|lamb chop|pork chop)\b/i.test(
    text,
  );
}

function parseSemicolonFields(text: string): StructuredCaptureField[] {
  const fields: StructuredCaptureField[] = [];
  for (const chunk of text.split(";").slice(1)) {
    const match = chunk.trim().match(/^([^:]+):\s*(.+)$/i);
    if (!match) continue;
    const label = match[1]!.trim();
    const value = match[2]!.trim();
    if (!label || !value) continue;
    fields.push(field(normalizeFieldLabel(label), value));
  }
  return fields;
}

function normalizeFieldLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower === "message" || lower === "message on cake") return "Message";
  if (lower === "date" || lower === "date needed") return "Date";
  if (lower === "servings" || lower === "serving") return "Servings";
  if (lower === "contact number" || lower === "phone") return "Contact";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function parseMultiCakeOrder(text: string): StructuredCaptureSummary | null {
  const match = text.match(
    /^(?:\d+|two|three|four|five|multiple)\s+cake orders?\s+for\s+(.+?):\s*(.+)$/i,
  );
  if (!match) return null;

  const date = match[1]!.trim().replace(/\.$/, "");
  const ordersText = match[2]!.trim();
  const items = ordersText
    .split(/\d+\.\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const fields: StructuredCaptureField[] = [field("Date", date)];
  items.forEach((item, index) => {
    const formatted = formatCakeListItem(item);
    fields.push(field(`Cake ${index + 1}`, formatted));
  });

  return { header: "Birthday cake orders", fields };
}

function formatCakeListItem(text: string): string {
  const forMatch = text.match(/\bfor\s+([A-Za-z][A-Za-z'-]{1,30})\b/i);
  const messageMatch = text.match(
    /message\s*['"]?([^'"]+)['"]?/i,
  );
  const parts = [
    forMatch?.[1] ? `For ${forMatch[1]}` : null,
    messageMatch?.[1]?.trim() ? `“${messageMatch[1].trim()}”` : null,
  ].filter(Boolean);
  return parts.join(" · ") || text;
}

function extractCakeDate(text: string): string | null {
  const explicit = text.match(/\bdate:\s*([^;.]+)/i)?.[1]?.trim();
  if (explicit) return explicit.replace(/\.$/, "");

  const weekday =
    text.match(
      /\bfor\s+[A-Za-z][A-Za-z'-]{1,30}\s+for\s+((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+the\s+\d{1,2}(?:st|nd|rd|th)?)?)\b/i,
    )?.[1] ||
    text.match(
      /\b((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+the\s+\d{1,2}(?:st|nd|rd|th)?)\b/i,
    )?.[1] ||
    text.match(
      /\bfor\s+((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+the\s+\d{1,2}(?:st|nd|rd|th)?)?)\b/i,
    )?.[1];

  return weekday?.trim() || null;
}

function extractCakeName(text: string): string | null {
  return (
    text.match(/\bbirthday cake(?:\s+order)?\s+for\s+([A-Za-z][A-Za-z'-]{1,30})\b/i)?.[1] ||
    text.match(/\bcake\s+for\s+([A-Za-z][A-Za-z'-]{1,30})\b/i)?.[1] ||
    null
  );
}

function extractCakeMessage(text: string): string | null {
  const quoted = text.match(
    /message(?:\s+on\s+cake)?[:]\s*['"]([^'"]+)['"]/i,
  )?.[1];
  if (quoted?.trim()) return quoted.trim();

  const plain = text.match(
    /message(?:\s+on\s+cake)?[:]\s*([^'.]+?)(?:\s+with|\s*\.|$)/i,
  )?.[1];
  return plain?.trim() || null;
}

function parseCakeOrderSummary(text: string): StructuredCaptureSummary | null {
  if (!looksLikeCakeOrder(text)) return null;

  const multi = parseMultiCakeOrder(text);
  if (multi) return multi;

  if (/;\s*\w+:/i.test(text)) {
    const semicolonFields = parseSemicolonFields(text);
    if (semicolonFields.length > 0) {
      return { header: "Birthday cake order", fields: semicolonFields };
    }
  }

  const fields: StructuredCaptureField[] = [];
  const name = extractCakeName(text);
  const date = extractCakeDate(text);
  const message = extractCakeMessage(text);
  const servings = text.match(/\b(\d{1,2})\s+(?:people|servings|serving)\b/i)?.[1];
  const notes = text.match(/\bwith\s+(.+?)(?:\.|$)/i)?.[1]?.trim();
  const contact = text.match(/contact number:\s*([^;.]+)/i)?.[1]?.trim();

  if (name) fields.push(field("For", name));
  if (date) fields.push(field("Date", date));
  if (message) fields.push(field("Message", message));
  if (servings) fields.push(field("Servings", servings));
  if (notes) fields.push(field("Notes", notes));
  if (contact) fields.push(field("Contact", contact));

  if (fields.length === 0) {
    fields.push(field("Details", text));
  }

  return { header: "Birthday cake order", fields };
}

function parseButcherRequestSummary(text: string): StructuredCaptureSummary | null {
  if (!looksLikeButcherRequest(text)) return null;

  let working = text
    .replace(/^Customer wants (?:the butcher to )?/i, "")
    .replace(/\.$/, "")
    .trim();

  const whenMatch =
    working.match(/\b(?:to be )?ready for\s+(.+)$/i) ||
    working.match(/\bfor collection\s+(.+)$/i) ||
    working.match(/\bpick(?:\s|-)?up\s+(.+)$/i);

  let whenValue: string | null = null;
  if (whenMatch?.[1]) {
    whenValue = whenMatch[1].trim();
    working = working
      .replace(/\s+to be ready for\s+.+$/i, "")
      .replace(/\s+for collection\s+.+$/i, "")
      .replace(/\s+pick(?:\s|-)?up\s+.+$/i, "")
      .trim();
  }

  const orderValue = working.replace(/^cut\s+/i, "").trim();
  const fields: StructuredCaptureField[] = [];

  if (orderValue) {
    fields.push(field("Order", orderValue));
  } else {
    fields.push(field("Request", text.replace(/\.$/, "").trim()));
  }

  if (whenValue) {
    fields.push(field("When", whenValue));
  }

  return { header: "Butcher request", fields };
}

function parseGenericProseSummary(text: string): StructuredCaptureSummary {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return {
      header: "Customer request",
      fields: [field("Details", text)],
    };
  }

  return {
    header: "Customer request",
    fields: sentences.map((sentence, index) =>
      field(index === 0 ? "Summary" : `Detail ${index}`, sentence),
    ),
  };
}

/** Parse any department ticket into a scannable header + label/value fields. */
export function parseDepartmentRequestSummary(
  summary: string | null | undefined,
): StructuredCaptureSummary | null {
  const structured = parseStructuredCaptureSummary(summary);
  if (structured) return structured;

  const cleaned = cleanSummary(summary);
  if (!cleaned) return null;

  return (
    parseCakeOrderSummary(cleaned) ||
    parseButcherRequestSummary(cleaned) ||
    parseGenericProseSummary(cleaned)
  );
}

/** Short request-type label for department list rows — not order contents. */
export function departmentRequestTypeLabel(header: string): string {
  const h = header.trim().replace(/\s+/g, " ");
  if (!h) return "Request";

  const lower = h.toLowerCase();

  if (lower.includes("complaint")) return "Complaint";
  if (lower.includes("manager callback")) return "Manager callback";
  if (/\b(stock check|in stock)\b/.test(lower)) return "Stock check";
  if (lower.includes("lost property") || lower.includes("lost item")) {
    return "Lost property";
  }
  if (
    /\border(s)?\b/.test(lower) ||
    lower.includes("butcher") ||
    lower.includes("cake") ||
    lower.includes("bakery")
  ) {
    return "Order";
  }
  if (/\bcallback\b/.test(lower)) return "Callback";
  if (lower.startsWith("customer request")) return "Request";

  if (/\brequest\b/.test(lower)) return "Request";

  return h.length <= 48 ? h : "Request";
}

/** Short list-row preview — request type only; details stay in the detail panel. */
export function formatDepartmentListPreview(
  parsed: StructuredCaptureSummary,
  maxLen = 120,
): string {
  return clipPreview(departmentRequestTypeLabel(parsed.header), maxLen);
}

function clipPreview(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "Follow-up needed";
  if (trimmed.length <= maxLen) return trimmed;

  const slice = trimmed.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  const clipped =
    lastSpace > Math.floor(maxLen * 0.55)
      ? slice.slice(0, lastSpace)
      : slice.trimEnd();
  return `${clipped.trimEnd()}…`;
}
