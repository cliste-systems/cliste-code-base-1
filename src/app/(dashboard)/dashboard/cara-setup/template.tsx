"use client";

import { usePathname } from "next/navigation";

import { DASHBOARD_FORM_STACK } from "@/components/dashboard/dashboard-surface";
import { DashboardPageTransition } from "@/components/dashboard/dashboard-page-transition";
import { cn } from "@/lib/utils";

export default function CaraSetupTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAnswersTab = pathname.endsWith("/answers");
  const stackClassName = cn(
    DASHBOARD_FORM_STACK,
    "flex flex-col",
    isAnswersTab
      ? "min-h-0 flex-1 overflow-hidden pb-4"
      : "shrink-0",
  );

  return (
    <DashboardPageTransition animateKey={pathname} className={stackClassName}>
      {children}
    </DashboardPageTransition>
  );
}
