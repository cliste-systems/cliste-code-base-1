import { sanitizePromptFreeText } from "@/lib/compile-cara-prompt";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";

export type StoreDepartmentsPromptInput = {
  departments: Pick<
    StoreDepartmentRow,
    | "name"
    | "active"
    | "transfer_enabled"
    | "extension"
    | "phone_e164"
    | "cara_note"
    | "handles_text"
    | "is_off_licence"
    | "is_an_post"
  >[];
  canTransfer: boolean;
};

function activeDepartments(
  departments: StoreDepartmentsPromptInput["departments"],
) {
  return departments.filter((d) => d.active);
}

export function storeDepartmentsPromptSection(
  input: StoreDepartmentsPromptInput,
): string {
  const departments = activeDepartments(input.departments);
  if (departments.length === 0) {
    return "Store departments are not configured yet — I take messages for any department request.";
  }

  const lines = departments.map((d) => {
    const name = sanitizePromptFreeText(d.name);
    const handles = d.handles_text?.trim()
      ? sanitizePromptFreeText(d.handles_text)
      : d.cara_note?.trim()
        ? sanitizePromptFreeText(d.cara_note)
        : null;
    const handlesPart = handles ? ` (${handles})` : "";
    if (d.is_off_licence) {
      return `• ${name}${handlesPart} — off-licence: I never sell alcohol or take ID details; I send callers to the counter.`;
    }
    if (d.is_an_post) {
      return `• ${name}${handlesPart} — An Post: I never guess tracking or delivery status; I send them to the counter.`;
    }
    if (input.canTransfer && d.transfer_enabled) {
      const target = d.extension?.trim() || d.phone_e164?.trim();
      const targetPart = target ? ` (${target})` : "";
      return `• ${name}${handlesPart} — I try to put them through${targetPart}; if no answer I take their name, number, and what they need.`;
    }
    return `• ${name}${handlesPart} — I take their name, number, and what they need, and pass it to ${name}.`;
  });

  const header = input.canTransfer
    ? "Store departments — when transfer is available:"
    : "Store departments — message-taking only (transfer not available on this setup):";

  return [header, ...lines].join("\n");
}
