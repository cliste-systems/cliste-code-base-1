/** Markers for dev/demo rows seeded into tenant dashboards — safe to bulk-delete. */

export const DASHBOARD_MOCK_CALLER_PREFIX = "+353555";
export const DASHBOARD_MOCK_REHEARSAL_CALLER_PREFIX = "+3538610099";
export const DASHBOARD_MOCK_REHEARSAL_MARKER = "[demo rehearsal]";

/** Gap summaries inserted by scripts/seed-kavanaghs-dashboard-activity.ts */
export const DASHBOARD_SEED_TRAINING_GAP_SUMMARIES = [
  "Real Rewards at partner petrol stations",
  "Christmas turkey pre-orders",
  "Student discount with MTU Kerry card",
  "EV charging in the car park",
  "Butcher lamb roast pre-orders",
  "Price matching on branded groceries",
] as const;

export function isDashboardMockCallerNumber(phone: string | null | undefined): boolean {
  const value = (phone ?? "").trim();
  if (!value) return false;
  if (value.startsWith(DASHBOARD_MOCK_CALLER_PREFIX)) return true;
  if (value.startsWith(DASHBOARD_MOCK_REHEARSAL_CALLER_PREFIX)) return true;
  return false;
}

export function isDashboardMockCallSid(callSid: string | null | undefined): boolean {
  const value = (callSid ?? "").trim();
  if (!value) return false;
  return value.startsWith("KAV-TEST-") || value.startsWith("RT-TEST-");
}

export function isDashboardMockText(text: string | null | undefined): boolean {
  return (text ?? "").includes(DASHBOARD_MOCK_REHEARSAL_MARKER);
}

export function isDashboardSeedTrainingGap(gapSummary: string | null | undefined): boolean {
  const value = (gapSummary ?? "").trim();
  if (!value) return false;
  if (isDashboardMockText(value)) return true;
  return (DASHBOARD_SEED_TRAINING_GAP_SUMMARIES as readonly string[]).includes(value);
}

export type DashboardMockCleanupCounts = {
  callLogs: number;
  actionTickets: number;
  caraTrainingItems: number;
  usageRecords: number;
};
