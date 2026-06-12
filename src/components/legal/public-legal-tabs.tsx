"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import { PUBLIC_LEGAL_PAGES } from "@/lib/legal-pages";
import { cn } from "@/lib/utils";

export function PublicLegalTabs() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Legal documents"
      className="no-scrollbar flex w-full items-stretch overflow-x-auto overflow-y-hidden rounded-full border border-slate-200/90 bg-slate-50/80 p-1"
    >
      {PUBLIC_LEGAL_PAGES.map((page) => {
        const active = pathname === page.href;
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-w-[4.75rem] flex-1 items-center justify-center rounded-full px-2.5 py-2 text-center text-[12px] font-medium whitespace-nowrap transition-colors sm:min-w-0 sm:px-3 sm:text-[13px]",
              active
                ? "text-white"
                : "text-slate-600 hover:bg-white/80 hover:text-[#0b1220]",
            )}
          >
            {active && !reduceMotion ? (
              <motion.span
                layoutId="public-legal-tab-pill"
                className="absolute inset-0 rounded-full bg-[#0b1220] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                transition={onboardingSpring}
              />
            ) : active ? (
              <span className="absolute inset-0 rounded-full bg-[#0b1220] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" />
            ) : null}
            <span className="relative z-[1]">{page.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
