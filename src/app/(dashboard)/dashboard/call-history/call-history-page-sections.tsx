"use client";

import { DashboardPageTransition } from "@/components/dashboard/dashboard-page-transition";

type CallHistoryPageSectionsProps = {
  animateKey: string;
  children: React.ReactNode;
};

/** Fade in Calls content when the selected day (or page) changes. */
export function CallHistoryPageSections({
  animateKey,
  children,
}: CallHistoryPageSectionsProps) {
  return (
    <DashboardPageTransition
      animateKey={animateKey}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
    >
      {children}
    </DashboardPageTransition>
  );
}
