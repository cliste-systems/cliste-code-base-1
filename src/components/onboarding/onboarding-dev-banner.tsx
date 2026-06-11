import { isOnboardingFreeNavEnabled } from "@/lib/onboarding-dev";

export function OnboardingDevBanner() {
  if (!isOnboardingFreeNavEnabled()) return null;

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-3 z-50 max-w-[min(100vw-2rem,28rem)] -translate-x-1/2 rounded-full bg-amber-600/95 px-4 py-1.5 text-center text-[11px] font-medium leading-snug text-white shadow-lg"
      role="status"
    >
      Dev: free nav + regulated verticals allowed — remove{" "}
      <code className="rounded bg-white/15 px-1">CLISTE_ONBOARDING_FREE_NAV</code>{" "}
      before production
    </div>
  );
}
