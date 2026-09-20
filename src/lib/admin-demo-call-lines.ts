import {
  INTERNAL_QA_LINE_E164,
  isTestCalledNumber,
  TEST_LINE_E164,
} from "@/lib/call-testing-types";
import type { ClientProvisionSource } from "@/lib/client-provision-source";

/** Kavanaghs SuperValu live demo — conversational retail lane. */
export const KAVANAGHS_DEMO_LINE_E164 = "+353749759508";

/** Fixed Irish mobile used for admin browser sim calls (readable in call history). */
export const ADMIN_SIM_CALLER_E164 = "+353870000001";

export type AdminDemoCallLine = {
  orgId: string;
  orgName: string;
  orgSlug: string;
  e164: string;
  niche: string | null;
  provisionSource: ClientProvisionSource;
  workerPath: string;
};

/** Well-known demo lines — used for worker-path labelling only. */
export const FEATURED_DEMO_LINE_E164 = [
  TEST_LINE_E164,
  KAVANAGHS_DEMO_LINE_E164,
  INTERNAL_QA_LINE_E164,
] as const;

export function workerPathLabelForE164(e164: string): string {
  if (isTestCalledNumber(e164)) return "Demo stack";
  if (e164.trim() === KAVANAGHS_DEMO_LINE_E164) return "Retail demo lane";
  return "Production";
}

export function formatIrishE164Display(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("353") && digits.length >= 11) {
    const national = digits.slice(3);
    if (national.length === 9) {
      return `+353 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
    }
  }
  return e164.trim();
}

export function sortDemoCallLinesByCompany(
  lines: AdminDemoCallLine[],
): AdminDemoCallLine[] {
  return [...lines].sort((a, b) =>
    a.orgName.localeCompare(b.orgName, "en", { sensitivity: "base" }),
  );
}
