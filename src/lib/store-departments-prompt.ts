import { sanitizePromptFreeText } from "@/lib/compile-cara-prompt";
import type { TransferCapability } from "@/lib/transfer-capability";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";

export type StoreDepartmentsPromptInput = {
  departments: Pick<
    StoreDepartmentRow,
    | "id"
    | "name"
    | "active"
    | "cara_note"
    | "handles_text"
    | "manager_name"
    | "is_off_licence"
    | "is_an_post"
  >[];
  capability: TransferCapability;
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
    const manager = d.manager_name?.trim()
      ? sanitizePromptFreeText(d.manager_name)
      : null;
    const handles = d.handles_text?.trim()
      ? sanitizePromptFreeText(d.handles_text)
      : d.cara_note?.trim()
        ? sanitizePromptFreeText(d.cara_note)
        : null;
    const handlesPart = handles ? ` (${handles})` : "";
    const managerPart = manager ? ` — manager: ${manager}` : "";
    if (d.is_off_licence) {
      return `• ${name}${handlesPart}${managerPart} — off-licence: I never sell alcohol or take ID details; I send callers to the counter.`;
    }
    if (d.is_an_post) {
      return `• ${name}${handlesPart}${managerPart} — An Post: I never guess tracking or delivery status; I send them to the counter.`;
    }
    const deptCap = input.capability.perDepartment[d.id];
    if (deptCap?.canTransfer) {
      return `• ${name}${handlesPart}${managerPart} — I can put you through to ${name}.`;
    }
    return `• ${name}${handlesPart}${managerPart} — I take their name, number, and what they need, and pass it to ${name}.`;
  });

  const header = input.capability.canTransfer
    ? "Store departments — when transfer is available:"
    : "Store departments — message-taking only:";

  return [header, ...lines].join("\n");
}
