"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PUBLIC_LEGAL_PAGES } from "@/lib/legal-pages";
import { cn } from "@/lib/utils";

export function LegalNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Legal documents"
      className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5"
    >
      {PUBLIC_LEGAL_PAGES.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-[#0b1220] text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-[#0b1220]",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
