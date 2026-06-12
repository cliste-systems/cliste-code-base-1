export const ONBOARDING_TOTAL_STEPS = 6;

export const ONBOARDING_STEPS_META = [
  { path: "/onboarding/profile", label: "Profile", shortLabel: "Profile" },
  { path: "/onboarding/voice", label: "Voice", shortLabel: "Voice" },
  { path: "/onboarding/knowledge", label: "Train Cara", shortLabel: "Cara" },
  { path: "/onboarding/number", label: "Your number", shortLabel: "Number" },
  { path: "/onboarding/test-call", label: "Test call", shortLabel: "Test" },
  { path: "/onboarding/plan", label: "Go live", shortLabel: "Plan" },
] as const;

/** Maps legacy DB steps (actions was step 4) to the current funnel. */
export function normalizeOnboardingDbStep(step: number): number {
  if (!Number.isFinite(step)) return 1;
  const n = Math.trunc(step);
  if (n >= 5) return n - 1;
  return n;
}

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

export function onboardingPreviousPath(pathname: string): string | null {
  const normalized = normalizeOnboardingPath(pathname);
  if (!normalized) return null;
  const idx = ONBOARDING_STEP_PATHS.indexOf(normalized);
  if (idx <= 0) return null;
  return ONBOARDING_STEP_PATHS[idx - 1] ?? null;
}
