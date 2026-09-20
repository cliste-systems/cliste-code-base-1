import {
  INTERNAL_QA_LINE_E164,
  TEST_LINE_E164,
} from "@/lib/call-testing-types";

/** Kavanaghs SuperValu live demo — conversational retail lane. */
export const KAVANAGHS_DEMO_LINE_E164 = "+353749759508";

/** Fixed Irish mobile used for admin browser sim calls (readable in call history). */
export const ADMIN_SIM_CALLER_E164 = "+353870000001";

export type AdminDemoCallLinePreset = {
  e164: string;
  label: string;
  description: string;
  workerPath: string;
};

export const ADMIN_DEMO_CALL_LINE_PRESETS: AdminDemoCallLinePreset[] = [
  {
    e164: TEST_LINE_E164,
    label: "Hello Cara demo",
    description: "Public demo line — conversational opening, trade playbooks, demo stack.",
    workerPath: "testCall → demo stack",
  },
  {
    e164: KAVANAGHS_DEMO_LINE_E164,
    label: "Kavanaghs SuperValu",
    description:
      "Retail demo line — production STT/LLM/TTS stack, SuperValu product search tools.",
    workerPath: "conversationalRetailLine → production retail",
  },
  {
    e164: INTERNAL_QA_LINE_E164,
    label: "Murphy's SuperValu QA",
    description: "Internal retail QA org — full production Cara for a SuperValu store.",
    workerPath: "production org",
  },
];

const ALLOWED_E164 = new Set(
  ADMIN_DEMO_CALL_LINE_PRESETS.map((line) => line.e164),
);

export function isAllowedAdminDemoCalledNumber(
  calledNumber: string | null | undefined,
): boolean {
  const raw = calledNumber?.trim() ?? "";
  return raw.length > 0 && ALLOWED_E164.has(raw);
}

export function normalizeAdminDemoCalledNumber(
  calledNumber: string | null | undefined,
): string | null {
  const raw = calledNumber?.trim() ?? "";
  if (!raw || !ALLOWED_E164.has(raw)) return null;
  return raw;
}

export type AdminDemoCallLine = AdminDemoCallLinePreset & {
  orgName: string | null;
  orgSlug: string | null;
};
