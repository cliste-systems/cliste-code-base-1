export const ONBOARDING_TOTAL_STEPS = 7;

export const ONBOARDING_STEPS_META = [
  { path: "/onboarding/profile", label: "Profile", shortLabel: "Profile" },
  { path: "/onboarding/voice", label: "Voice", shortLabel: "Voice" },
  { path: "/onboarding/knowledge", label: "Train Cara", shortLabel: "Cara" },
  { path: "/onboarding/actions", label: "Actions", shortLabel: "Actions" },
  { path: "/onboarding/number", label: "Your number", shortLabel: "Number" },
  { path: "/onboarding/test-call", label: "Test call", shortLabel: "Test" },
  { path: "/onboarding/plan", label: "Go live", shortLabel: "Plan" },
] as const;

export type OnboardingStepPath = (typeof ONBOARDING_STEPS_META)[number]["path"];

export const ONBOARDING_STEP_PATHS = ONBOARDING_STEPS_META.map(
  (step) => step.path,
) as unknown as readonly OnboardingStepPath[];

export function normalizeOnboardingPath(pathname: string): OnboardingStepPath | null {
  const base = pathname.split("?")[0]?.replace(/\/$/, "") ?? "";
  const match = ONBOARDING_STEP_PATHS.find((path) => path === base);
  return match ?? null;
}

export function onboardingStepIndex(pathname: string): number {
  const normalized = normalizeOnboardingPath(pathname);
  if (!normalized) return 1;
  const idx = ONBOARDING_STEP_PATHS.indexOf(normalized);
  return idx >= 0 ? idx + 1 : 1;
}

/** Map DB `onboarding_step` (1–7) to footer step index (1–7). */
export function onboardingProgressFromDbStep(dbStep: number): number {
  if (!Number.isFinite(dbStep)) return 1;
  return Math.min(Math.max(Math.trunc(dbStep), 1), ONBOARDING_TOTAL_STEPS);
}

export function onboardingPreviousPath(pathname: string): string | null {
  const normalized = normalizeOnboardingPath(pathname);
  if (!normalized) return null;
  const idx = ONBOARDING_STEP_PATHS.indexOf(normalized);
  if (idx <= 0) return null;
  return ONBOARDING_STEP_PATHS[idx - 1] ?? null;
}
