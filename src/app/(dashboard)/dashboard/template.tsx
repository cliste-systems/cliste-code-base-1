"use client";

import { usePathname } from "next/navigation";

import { DashboardPageTransition } from "@/components/dashboard/dashboard-page-transition";
import { dashboardTopLevelAnimateKey } from "@/lib/dashboard-animate-key";

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const animateKey = dashboardTopLevelAnimateKey(pathname);

  // Home animates inside the page — avoids double-fade and flex layout breakage.
  if (animateKey === "home") {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">{children}</div>
    );
  }

  return (
    <DashboardPageTransition
      animateKey={animateKey}
      className="flex h-full min-h-0 flex-1 flex-col"
    >
      {children}
    </DashboardPageTransition>
  );
}
