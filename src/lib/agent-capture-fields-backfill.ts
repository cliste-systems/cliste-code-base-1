import type { CaraGoal } from "@/lib/cara-goal";

import { captureFieldsFromDetailsText } from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-text";
import {
  cleanCaptureFields,
  composeCaptureDetailsNote,
  defaultCaptureFieldsForBusinessType,
  ensureRequiredCaptureFields,
  type CaraCaptureField,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";

const COMMA_SPLIT_ARTIFACT = /^and their\b/i;

const BOOKING_CAPTURE_IDS = new Set([
  "preferred_service",
  "preferred_day",
  "preferred_time",
  "stylist",
  "first_visit",
]);

/** Detect rows corrupted by comma-splitting `agent_details_to_collect` on save. */
export function isCorruptCaptureFields(fields: CaraCaptureField[]): boolean {
  if (fields.length === 0) return false;

  const ids = fields.map((field) => field.id.toLowerCase());
  const labels = fields.map((field) => field.label.trim().toLowerCase());

  if (new Set(ids).size !== ids.length) return true;
  if (new Set(labels).size !== labels.length) return true;

  for (const field of fields) {
    if (COMMA_SPLIT_ARTIFACT.test(field.label)) return true;
    if (field.id.startsWith("custom_and_")) return true;
  }

  const nameFields = fields.filter((field) => /name/i.test(field.label));
  if (nameFields.length > 1) return true;

  const phoneFields = fields.filter((field) => /phone/i.test(field.label));
  if (phoneFields.length > 1) return true;

  if (fields.length > 12) return true;

  return false;
}

export function looksLikeCorruptDetailsText(text: string): boolean {
  return COMMA_SPLIT_ARTIFACT.test(text.trim());
}

/** Short comma-separated lists may be owner-authored before structured chips existed. */
export function looksLikeOwnerAuthoredCaptureText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return false;
  if (trimmed.includes("\n")) return false;
  if (looksLikeCorruptDetailsText(trimmed)) return false;

  const parts = trimmed
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);

  return parts.length >= 2 && parts.length <= 12;
}

export function defaultCaptureFieldsForCaraGoal(
  businessType: string,
  niche?: string | null,
  caraGoal?: CaraGoal,
): CaraCaptureField[] {
  if (caraGoal === "faq_only") {
    return faqOnlyDefaultCaptureFields();
  }
  return defaultCaptureFieldsForBusinessType(businessType, niche);
}

export function faqOnlyDefaultCaptureFields(): CaraCaptureField[] {
  return ensureRequiredCaptureFields([
    { id: "name", label: "Name" },
    { id: "phone", label: "Phone number" },
    { id: "what_they_need", label: "What they need" },
    { id: "callback_time", label: "Preferred callback time" },
  ]);
}

export function isBookingOrientedCaptureId(id: string): boolean {
  return BOOKING_CAPTURE_IDS.has(id.toLowerCase());
}

export type ResolveCaptureFieldsInput = {
  rawFields: unknown;
  detailsText?: string | null;
  businessType: string;
  niche?: string | null;
  caraGoal?: CaraGoal;
};

/** Load-time resolver: prefer clean structure, else safe defaults. */
export function resolveCaptureFieldsForOrg(
  input: ResolveCaptureFieldsInput,
): CaraCaptureField[] {
  const cleaned = cleanCaptureFields(input.rawFields);
  if (cleaned.length >= 2 && !isCorruptCaptureFields(cleaned)) {
    return cleaned;
  }

  const detailsText = String(input.detailsText ?? "").trim();
  if (detailsText && looksLikeOwnerAuthoredCaptureText(detailsText)) {
    const fromText = captureFieldsFromDetailsText(detailsText);
    if (!isCorruptCaptureFields(fromText)) {
      return fromText;
    }
  }

  return defaultCaptureFieldsForCaraGoal(
    input.businessType,
    input.niche,
    input.caraGoal,
  );
}

export function backfillCaptureFieldsForOrg(
  input: ResolveCaptureFieldsInput,
): { fields: CaraCaptureField[]; detailsText: string; wasCorrupt: boolean } {
  const existing = cleanCaptureFields(input.rawFields);
  const corrupt =
    existing.length >= 2 && isCorruptCaptureFields(existing);

  if (!corrupt && existing.length >= 2) {
    const fields = existing;
    return {
      fields,
      detailsText: composeCaptureDetailsNote(fields),
      wasCorrupt: false,
    };
  }

  const fields = defaultCaptureFieldsForCaraGoal(
    input.businessType,
    input.niche,
    input.caraGoal,
  );

  return {
    fields,
    detailsText: composeCaptureDetailsNote(fields),
    wasCorrupt: corrupt || existing.length > 0,
  };
}
