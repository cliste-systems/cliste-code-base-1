import {
  CAPTURE_REQUIRED_FIELDS,
  cleanCaptureFields,
  createCustomCaptureField,
  ensureRequiredCaptureFields,
  type CaraCaptureField,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function isRequiredLabel(label: string): boolean {
  const norm = normalizeLabel(label);
  return CAPTURE_REQUIRED_FIELDS.some(
    (field) => normalizeLabel(field.label) === norm,
  );
}

/** Chip labels for the dashboard details editor, in capture-field order. */
export function detailLabelsFromCaptureFields(
  fields: CaraCaptureField[],
): string[] {
  return cleanCaptureFields(fields).map((field) => field.label);
}

/**
 * Keep structured capture fields aligned with dashboard chip edits.
 * Preserves known field ids when labels match; creates custom fields for new labels.
 */
export function syncCaptureFieldsFromDetailLabels(
  existing: CaraCaptureField[],
  labels: string[],
): CaraCaptureField[] {
  const cleanedExisting = cleanCaptureFields(existing);
  const byLabel = new Map(
    cleanedExisting.map((field) => [normalizeLabel(field.label), field]),
  );

  const optionalLabels = labels
    .map((label) => label.trim())
    .filter((label) => label.length > 1 && !isRequiredLabel(label));

  const seenLabels = new Set<string>();
  const optionalFields: CaraCaptureField[] = [];

  for (const label of optionalLabels) {
    const key = normalizeLabel(label);
    if (seenLabels.has(key)) continue;
    seenLabels.add(key);

    const matched = byLabel.get(key);
    if (matched) {
      optionalFields.push(matched);
      continue;
    }

    const created = createCustomCaptureField(label);
    if (created) optionalFields.push(created);
  }

  return ensureRequiredCaptureFields(optionalFields);
}
