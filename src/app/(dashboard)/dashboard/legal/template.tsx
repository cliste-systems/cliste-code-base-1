"use client";

import { usePathname } from "next/navigation";

import { DashboardPageTransition } from "@/components/dashboard/dashboard-page-transition";

export default function LegalTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <DashboardPageTransition animateKey={pathname}>
      {children}
    </DashboardPageTransition>
  );
}
