"use client";

import { createContext, useContext, type ReactNode } from "react";

type OnboardingProgressContextValue = {
  /** `organizations.onboarding_step` (1–6). */
  furthestDbStep: number;
  /** True when `CLISTE_ONBOARDING_FREE_NAV` is on (dev only). */
  freeNav: boolean;
};

const OnboardingProgressContext = createContext<OnboardingProgressContextValue>({
  furthestDbStep: 1,
  freeNav: false,
});

export function OnboardingProgressProvider({
  furthestDbStep,
  freeNav,
  children,
}: {
  furthestDbStep: number;
  freeNav: boolean;
  children: ReactNode;
}) {
  return (
    <OnboardingProgressContext.Provider value={{ furthestDbStep, freeNav }}>
      {children}
    </OnboardingProgressContext.Provider>
  );
}

export function useOnboardingProgress() {
  return useContext(OnboardingProgressContext);
}
