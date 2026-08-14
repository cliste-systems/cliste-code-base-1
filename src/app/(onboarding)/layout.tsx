import { OnboardingCanvasBackground } from "@/components/onboarding/onboarding-canvas-background";
import { OnboardingKnowledgeNavProvider } from "@/components/onboarding/onboarding-knowledge-nav";
import { OnboardingMotionShell } from "@/components/onboarding/onboarding-motion-shell";
import { OnboardingProgressProvider } from "@/components/onboarding/onboarding-progress";
import { OnboardingStepDots } from "@/components/onboarding/onboarding-step-dots";
import { OnboardingViewportLock } from "@/components/onboarding/onboarding-viewport-lock";
import { isOnboardingFreeNavEnabled } from "@/lib/onboarding-dev";
import { enforceOnboardingLegalAcceptance } from "@/lib/onboarding-legal-gate";
import { requireOnboardingSession } from "@/lib/onboarding-session";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOnboardingSession();
  await enforceOnboardingLegalAcceptance(session);
  const freeNav = isOnboardingFreeNavEnabled();

  return (
    <>
      <OnboardingViewportLock />
      <main className="fixed inset-0 z-10 flex h-dvh max-h-dvh flex-col overflow-hidden text-slate-900 [&_button:not(:disabled)]:cursor-pointer">
        <OnboardingCanvasBackground />
        <div
          className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{ backgroundColor: "transparent" }}
        >
          <OnboardingProgressProvider
            furthestDbStep={session.onboardingStep}
            freeNav={freeNav}
          >
            <OnboardingKnowledgeNavProvider>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <OnboardingMotionShell>{children}</OnboardingMotionShell>
                <OnboardingStepDots />
              </div>
            </OnboardingKnowledgeNavProvider>
          </OnboardingProgressProvider>
        </div>
      </main>
    </>
  );
}
