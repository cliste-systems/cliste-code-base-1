"use client";

import { usePathname } from "next/navigation";

import { DashboardPageTransition } from "@/components/dashboard/dashboard-page-transition";
import { cn } from "@/lib/utils";

export default function RoutingTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const stackClassName = cn("flex min-h-0 flex-1 flex-col overflow-hidden");

  return (
    <DashboardPageTransition animateKey={pathname} className={stackClassName}>
      {children}
    </DashboardPageTransition>
  );
}
