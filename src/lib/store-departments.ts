import type { StoreDepartmentRow } from "@/lib/retail-store-types";

export function syncAgentServicesDepartmentsFromStore(
  departments: Pick<StoreDepartmentRow, "name" | "active">[],
): string {
  return departments
    .filter((d) => d.active)
    .map((d) => d.name.trim())
    .filter(Boolean)
    .join(", ");
}

export function validateDepartmentExtension(
  extension: string | null | undefined,
): string | null {
  const value = extension?.trim() ?? "";
  if (!value) return null;
  if (value.length > 12) return "Extension must be 12 characters or fewer.";
  if (!/^[0-9*#]+$/i.test(value)) {
    return "Extension may only contain digits, * and #.";
  }
  return null;
}
