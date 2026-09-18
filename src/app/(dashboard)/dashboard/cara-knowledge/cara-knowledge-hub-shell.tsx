"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CARA_KNOWLEDGE_SECTIONS,
  caraKnowledgeSectionForPath,
} from "@/lib/cara-knowledge-sections";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

export function CaraKnowledgeHubShell({
  children,
  openInputCount,
}: {
  children: React.ReactNode;
  openInputCount: number;
}) {
  const pathname = usePathname();
  const activeSection = caraKnowledgeSectionForPath(pathname);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="shrink-0 lg:w-[240px]">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-3 border-b border-slate-100 pb-3">
            <p className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
              Cara&apos;s Knowledge
            </p>
            <p className="mt-1 text-[12px] leading-snug text-slate-500">
              Everything Cara knows, learns and still needs to learn about your
              business
            </p>
          </div>

          <nav className="space-y-1" aria-label="Cara knowledge sections">
            {CARA_KNOWLEDGE_SECTIONS.map((section) => {
              const active = activeSection === section.id;
              const badge =
                section.id === "needs-input" && openInputCount > 0
                  ? openInputCount
                  : null;
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span>{section.label}</span>
                  {badge ? (
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                        active
                          ? "bg-white/15 text-white"
                          : "border border-slate-200 bg-slate-50 text-slate-600",
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function CaraKnowledgeSectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 shrink-0">
      <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1220]">
        {title}
      </h1>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-500">
        {description}
      </p>
    </div>
  );
}

export function CaraKnowledgeHomeLink() {
  return (
    <Link
      href={DASHBOARD_ROUTES.caraKnowledge}
      className="text-[12px] font-medium text-slate-500 hover:text-slate-800"
    >
      Back to search
    </Link>
  );
}
