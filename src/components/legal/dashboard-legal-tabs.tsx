"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import { DASHBOARD_LEGAL_PAGES } from "@/lib/legal-pages";
import { cn } from "@/lib/utils";

export function DashboardLegalTabs() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Legal sections"
      className="no-scrollbar flex w-full min-w-0 items-stretch overflow-x-auto rounded-full border border-[#e5eaf2] bg-white/70 p-1 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur"
    >
      {DASHBOARD_LEGAL_PAGES.map((page) => {
        const active = pathname === page.href;
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-w-[5.5rem] flex-1 items-center justify-center rounded-full px-3 py-2.5 text-center text-[13px] font-medium whitespace-nowrap transition-colors sm:min-w-0 sm:px-4",
              active
                ? "text-white"
                : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]",
            )}
          >
            {active && !reduceMotion ? (
              <motion.span
                layoutId="legal-tab-pill"
                className="absolute inset-0 rounded-full bg-[#0b1220] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_6px_rgba(15,23,42,0.12)]"
                transition={onboardingSpring}
              />
            ) : active ? (
              <span className="absolute inset-0 rounded-full bg-[#0b1220] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_6px_rgba(15,23,42,0.12)]" />
            ) : null}
            <span className="relative z-[1]">{page.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
