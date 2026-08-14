import {
  defaultWeekSchedule,
  parseBusinessHoursBundle,
  serializeBusinessHours,
  type WeekSchedule,
} from "@/lib/business-hours";
import { formatWeekScheduleForAgent } from "@/lib/agent-knowledge-format";
import { sanitizePromptFreeText } from "@/lib/prompt-tenant-boundary";

export const MAX_STORE_DEPARTMENTS = 24;
export const MAX_DEPARTMENT_NAME_LENGTH = 80;
export const MAX_DEPARTMENT_TRANSFER_LENGTH = 32;

export type StoreDepartment = {
  id: string;
  organizationId: string;
  name: string;
  usesStoreHours: boolean;
  hours: WeekSchedule | null;
  transferNumber: string;
  isOffLicence: boolean;
  isAnPost: boolean;
  sortOrder: number;
};

export type StoreDepartmentDraft = {
  id?: string;
  clientId: string;
  name: string;
  usesStoreHours: boolean;
  hours: WeekSchedule;
  transferNumber: string;
  isOffLicence: boolean;
  isAnPost: boolean;
};

export function emptyDepartmentDraft(clientId: string): StoreDepartmentDraft {
  return {
    clientId,
    name: "",
    usesStoreHours: true,
    hours: defaultWeekSchedule(),
    transferNumber: "",
    isOffLicence: false,
    isAnPost: false,
  };
}

export function departmentFromRow(row: Record<string, unknown>): StoreDepartment {
  const hoursRaw = row.hours;
  const hours =
    hoursRaw && typeof hoursRaw === "object"
      ? parseBusinessHoursBundle(hoursRaw).schedule
      : null;
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name ?? "").trim(),
    usesStoreHours: row.uses_store_hours !== false,
    hours,
    transferNumber: String(row.transfer_number ?? "").trim(),
    isOffLicence: row.is_off_licence === true,
    isAnPost: row.is_an_post === true,
    sortOrder:
      typeof row.sort_order === "number" && Number.isFinite(row.sort_order)
        ? row.sort_order
        : 0,
  };
}

export function draftFromDepartment(dept: StoreDepartment): StoreDepartmentDraft {
  return {
    id: dept.id,
    clientId: dept.id,
    name: dept.name,
    usesStoreHours: dept.usesStoreHours,
    hours: dept.hours ?? defaultWeekSchedule(),
    transferNumber: dept.transferNumber,
    isOffLicence: dept.isOffLicence,
    isAnPost: dept.isAnPost,
  };
}

export function draftsFromChipNames(names: string[]): StoreDepartmentDraft[] {
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, MAX_STORE_DEPARTMENTS)
    .map((name, i) => ({
      ...emptyDepartmentDraft(`chip-${i}-${name.toLowerCase()}`),
      name,
    }));
}

export function departmentNames(drafts: StoreDepartmentDraft[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of drafts) {
    const name = d.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function serializeDepartmentHours(hours: WeekSchedule): Record<string, unknown> {
  return serializeBusinessHours(hours, {});
}

function departmentHoursLine(dept: {
  usesStoreHours: boolean;
  hours: WeekSchedule | null;
}): string | null {
  if (dept.usesStoreHours || !dept.hours) return null;
  const formatted = formatWeekScheduleForAgent(dept.hours);
  return formatted || "closed all week";
}

/** First-person prompt block for store departments (retail). */
export function storeDepartmentsPromptSection(
  departments: Array<{
    name: string;
    usesStoreHours: boolean;
    hours: WeekSchedule | null;
    transferNumber: string;
    isOffLicence: boolean;
    isAnPost: boolean;
  }>,
): string {
  const rows = departments
    .map((d) => ({ ...d, name: d.name.trim() }))
    .filter((d) => d.name);
  if (rows.length === 0) return "";

  const lines: string[] = ["Departments in this store:"];
  for (const d of rows) {
    const bits: string[] = [sanitizePromptFreeText(d.name)];
    const hours = departmentHoursLine(d);
    if (hours) bits.push(`hours ${sanitizePromptFreeText(hours).replace(/\n/g, "; ")}`);
    else bits.push("same hours as the store");
    if (d.transferNumber.trim()) {
      bits.push(`put callers through to ${sanitizePromptFreeText(d.transferNumber.trim())}`);
    }
    if (d.isOffLicence) bits.push("off-licence");
    if (d.isAnPost) bits.push("An Post");
    lines.push(`• ${bits.join(" — ")}`);
  }

  lines.push(
    [
      "When someone asks for a department:",
      "• If it is listed, I say so and use that department's hours or transfer number when set.",
      "• If it is not listed, I don't guess — I take their name, number, and what they need.",
    ].join("\n"),
  );

  if (rows.some((d) => d.isOffLicence)) {
    lines.push(
      "Off-licence: I never sell or promise alcohol, tobacco, or age-restricted items on the phone. I do not take ID details. I offer to put them through to the off-licence or take a message.",
    );
  }
  if (rows.some((d) => d.isAnPost)) {
    lines.push(
      "An Post: I never guess tracking, delivery times, or whether a parcel is ready. I offer to put them through to An Post or take a message with their name, number, and what they need.",
    );
  }

  return lines.join("\n");
}

export const RETAIL_LIVE_STOCK_PRICE_INSTRUCTION =
  "I never quote live stock, shelf prices, or today's specials — those change on the shop floor. I offer to put the caller through to the right department, or take their name, number, and what they need.";
