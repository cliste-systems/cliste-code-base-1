"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

import { onboardingSpring } from "@/components/onboarding/onboarding-motion";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/cara-setup/general", label: "General" },
  { href: "/dashboard/cara-setup/services", label: "Services" },
  { href: "/dashboard/cara-setup/call-handling", label: "Call handling" },
  { href: "/dashboard/cara-setup/answers", label: "Answers & files" },
] as const;

export function CaraSetupTabs() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [scrollbar-width:none] sm:gap-1.5"
      aria-label="Cara Setup sections"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-[#0b1220]",
            )}
            aria-current={active ? "page" : undefined}
          >
            {active && !reduceMotion ? (
              <motion.span
                layoutId="cara-setup-tab-pill"
                className="absolute inset-0 rounded-lg bg-[#0b1220]"
                transition={onboardingSpring}
              />
            ) : active ? (
              <span className="absolute inset-0 rounded-lg bg-[#0b1220]" />
            ) : null}
            <span className="relative z-[1]">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
