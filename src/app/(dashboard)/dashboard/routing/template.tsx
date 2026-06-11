"use client";

import { usePathname } from "next/navigation";

import { DASHBOARD_FORM_STACK } from "@/components/dashboard/dashboard-surface";
import { DashboardPageTransition } from "@/components/dashboard/dashboard-page-transition";
import { cn } from "@/lib/utils";

export default function RoutingTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const stackClassName = cn(
    DASHBOARD_FORM_STACK,
    "flex min-h-0 flex-1 flex-col overflow-hidden",
  );

  return (
    <DashboardPageTransition animateKey={pathname} className={stackClassName}>
      {children}
    </DashboardPageTransition>
  );
}
