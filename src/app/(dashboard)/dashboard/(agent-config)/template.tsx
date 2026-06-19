"use client";

import { usePathname } from "next/navigation";

import { DashboardPageTransition } from "@/components/dashboard/dashboard-page-transition";

export default function AgentConfigTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const stackClassName = "flex h-full min-h-0 flex-1 flex-col overflow-hidden";

  return (
    <DashboardPageTransition animateKey={pathname} className={stackClassName}>
      {children}
    </DashboardPageTransition>
  );
}
