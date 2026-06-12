import { detectTradePack, type TradePack } from "./train-cara-trade-topics";

export type CaraCaptureField = {
  id: string;
  label: string;
  custom?: boolean;
};

export type CaptureFieldOption = {
  id: string;
  label: string;
  hint?: string;
};

export const CAPTURE_REQUIRED_FIELDS: readonly CaptureFieldOption[] = [
  { id: "name", label: "Name" },
  { id: "phone", label: "Phone number" },
];

const TRADES_CAPTURE_OPTIONS: CaptureFieldOption[] = [
  { id: "address", label: "Address", hint: "Where the job is" },
  { id: "issue", label: "Description of issue", hint: "What's wrong" },
  { id: "urgency", label: "Urgency", hint: "Emergency or can it wait" },
  {
    id: "callback_time",
    label: "Preferred callback time",
    hint: "When to ring them back",
  },
  { id: "eircode", label: "Eircode", hint: "If they know it" },
];

const SALON_CAPTURE_OPTIONS: CaptureFieldOption[] = [
  { id: "preferred_service", label: "Preferred service", hint: "Cut, colour, etc." },
  { id: "preferred_day", label: "Preferred day", hint: "When they want to come in" },
  { id: "preferred_time", label: "Preferred time", hint: "Morning or afternoon" },
  { id: "stylist", label: "Stylist preference", hint: "Anyone or someone specific" },
  { id: "first_visit", label: "First visit?", hint: "New or returning client" },
];

const DEFAULT_CAPTURE_OPTIONS: CaptureFieldOption[] = [
  { id: "what_they_need", label: "What they need", hint: "Reason for the call" },
  { id: "location", label: "Location", hint: "Town or address if relevant" },
  { id: "urgency", label: "Urgency", hint: "How soon they need help" },
  {
    id: "callback_time",
    label: "Preferred callback time",
    hint: "When to follow up",
  },
  { id: "email", label: "Email", hint: "For confirmations or quotes" },
];

export function captureOptionsForPack(pack: TradePack): CaptureFieldOption[] {
  if (pack === "trades") return TRADES_CAPTURE_OPTIONS;
  if (pack === "salon") return SALON_CAPTURE_OPTIONS;
  return DEFAULT_CAPTURE_OPTIONS;
}

export function defaultCaptureFieldsForBusinessType(
  businessType: string,
): CaraCaptureField[] {
  const pack = detectTradePack(businessType);
  const required = CAPTURE_REQUIRED_FIELDS.map((field) => ({
    id: field.id,
    label: field.label,
  }));

  if (pack === "trades") {
    return [
      ...required,
      { id: "address", label: "Address" },
      { id: "issue", label: "Description of issue" },
      { id: "urgency", label: "Urgency" },
    ];
  }

  if (pack === "salon") {
    return [
      ...required,
      { id: "preferred_service", label: "Preferred service" },
      { id: "preferred_day", label: "Preferred day" },
    ];
  }

  return [
    ...required,
    { id: "what_they_need", label: "What they need" },
    { id: "location", label: "Location" },
    { id: "urgency", label: "Urgency" },
  ];
}

function slugifyCustomLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return slug ? `custom_${slug}` : `custom_${Date.now()}`;
}

export function cleanCaptureFields(fields: unknown): CaraCaptureField[] {
  if (!Array.isArray(fields)) return [];

  const seen = new Set<string>();
  const out: CaraCaptureField[] = [];

  for (const item of fields) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = String(record.id ?? "").trim().slice(0, 64);
    const label = String(record.label ?? "").trim().slice(0, 80);
    if (!id || !label) continue;

    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id,
      label,
      custom: record.custom === true,
    });
    if (out.length >= 12) break;
  }

  return ensureRequiredCaptureFields(out);
}

export function ensureRequiredCaptureFields(
  fields: CaraCaptureField[],
): CaraCaptureField[] {
  const byId = new Map(fields.map((field) => [field.id.toLowerCase(), field]));

  for (const required of CAPTURE_REQUIRED_FIELDS) {
    if (!byId.has(required.id)) {
      byId.set(required.id, { id: required.id, label: required.label });
    }
  }

  const ordered: CaraCaptureField[] = CAPTURE_REQUIRED_FIELDS.map(
    (required) => byId.get(required.id)!,
  );

  for (const field of fields) {
    if (CAPTURE_REQUIRED_FIELDS.some((required) => required.id === field.id)) {
      continue;
    }
    if (!ordered.some((existing) => existing.id === field.id)) {
      ordered.push(field);
    }
  }

  return ordered.slice(0, 12);
}

export function parseAgentCaptureFields(value: unknown): CaraCaptureField[] | null {
  const cleaned = cleanCaptureFields(value);
  if (cleaned.length < 2) return null;
  return cleaned;
}

export function composeCaptureDetailsNote(fields: CaraCaptureField[]): string {
  const labels = ensureRequiredCaptureFields(fields).map((field) =>
    field.label.trim().toLowerCase(),
  );

  if (labels.length === 0) {
    return "Name, phone number, what they need, location, urgency, and preferred callback time.";
  }
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}.`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}.`;
}

export function createCustomCaptureField(label: string): CaraCaptureField | null {
  const trimmed = label.trim().slice(0, 80);
  if (trimmed.length < 2) return null;
  return {
    id: slugifyCustomLabel(trimmed),
    label: trimmed,
    custom: true,
  };
}

