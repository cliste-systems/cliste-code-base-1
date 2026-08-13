import { notFound } from "next/navigation";

import { OnboardingCanvasBackground } from "@/components/onboarding/onboarding-canvas-background";
import { OnboardingKnowledgeNavProvider } from "@/components/onboarding/onboarding-knowledge-nav";
import { OnboardingMotionShell } from "@/components/onboarding/onboarding-motion-shell";
import { OnboardingProgressProvider } from "@/components/onboarding/onboarding-progress";
import { OnboardingViewportLock } from "@/components/onboarding/onboarding-viewport-lock";
import { isDevOnboardingPreviewEnabled } from "@/lib/onboarding-dev";

export const dynamic = "force-dynamic";

export default function DevOnboardingPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isDevOnboardingPreviewEnabled()) {
    notFound();
  }

  return (
    <>
      <OnboardingViewportLock />
      <main className="fixed inset-0 z-10 flex h-dvh max-h-dvh flex-col overflow-hidden text-slate-900 [&_button:not(:disabled)]:cursor-pointer">
        <OnboardingCanvasBackground />
        <div
          className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{ backgroundColor: "transparent" }}
        >
          <div className="shrink-0 bg-amber-100/95 px-3 py-1.5 text-center text-[11px] font-medium text-amber-950">
            Local preview — not signed in. Changes here are dev-only and are not
            deployed.
          </div>
          <OnboardingProgressProvider furthestDbStep={5} freeNav>
            <OnboardingKnowledgeNavProvider>
              <OnboardingMotionShell>{children}</OnboardingMotionShell>
            </OnboardingKnowledgeNavProvider>
          </OnboardingProgressProvider>
        </div>
      </main>
    </>
  );
}
