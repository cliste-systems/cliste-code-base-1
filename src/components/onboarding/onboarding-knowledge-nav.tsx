"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type KnowledgeNavContextValue = {
  internalStepIndex: number;
  setInternalStepIndex: (index: number) => void;
};

const KnowledgeNavContext = createContext<KnowledgeNavContextValue>({
  internalStepIndex: 0,
  setInternalStepIndex: () => {},
});

export function OnboardingKnowledgeNavProvider({ children }: { children: ReactNode }) {
  const [internalStepIndex, setInternalStepIndex] = useState(0);
  const value = useMemo(
    () => ({ internalStepIndex, setInternalStepIndex }),
    [internalStepIndex],
  );

  return (
    <KnowledgeNavContext.Provider value={value}>{children}</KnowledgeNavContext.Provider>
  );
}

export function useOnboardingKnowledgeNav() {
  return useContext(KnowledgeNavContext);
}
