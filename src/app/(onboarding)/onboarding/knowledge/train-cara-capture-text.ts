import {
  cleanCaptureFields,
  createCustomCaptureField,
  ensureRequiredCaptureFields,
  type CaraCaptureField,
} from "./train-cara-capture-fields";

export function captureFieldsFromDetailsText(text: string): CaraCaptureField[] {
  const trimmed = text.trim();
  if (!trimmed) return ensureRequiredCaptureFields([]);

  const parts = trimmed
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);

  const fields: CaraCaptureField[] = [];
  for (const part of parts) {
    const field = createCustomCaptureField(part);
    if (field) fields.push(field);
  }

  return cleanCaptureFields(ensureRequiredCaptureFields(fields));
}
