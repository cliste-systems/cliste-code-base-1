/** Column header for the resource (staff) grid. */
export type CalendarStaffMember = {
  id: string;
  name: string;
};

/** Stable mock staff when org has no staff/admin profiles yet. */
export const MOCK_CALENDAR_STAFF: CalendarStaffMember[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Alex Morgan" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Jordan Lee" },
  { id: "00000000-0000-4000-8000-000000000003", name: "Sam Rivera" },
];

export const UNASSIGNED_STAFF_ID = "__unassigned__";

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (
    (parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")
  ).toUpperCase();
}
