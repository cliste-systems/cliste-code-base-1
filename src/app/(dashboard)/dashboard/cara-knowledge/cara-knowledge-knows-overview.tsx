import Link from "next/link";

import {
  CaraKnowledgeSectionHeader,
} from "@/app/(dashboard)/dashboard/cara-knowledge/cara-knowledge-hub-shell";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  CARA_KNOWLEDGE_CATEGORIES,
} from "@/lib/cara-knowledge-sections";
import {
  categoryCounts,
  type CaraKnowledgeIndex,
} from "@/lib/cara-knowledge-index";
import { cn } from "@/lib/utils";

export function CaraKnowledgeKnowsOverview({
  index,
}: {
  index: CaraKnowledgeIndex;
}) {
  const counts = categoryCounts(index);

  return (
    <>
      <CaraKnowledgeSectionHeader
        title="What Cara knows"
        description="Everything currently active in Cara's brain."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CARA_KNOWLEDGE_CATEGORIES.map((category) => (
          <Link
            key={category.id}
            href={category.href}
            className={cn(
              DASHBOARD_CARD_SURFACE,
              "flex min-h-[120px] flex-col p-4 transition-colors hover:border-slate-300",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-[#0b1220]">
                  {category.label}
                </h2>
                <p className="mt-1 text-[12px] leading-snug text-slate-500">
                  {category.description}
                </p>
              </div>
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold tabular-nums text-slate-600">
                {counts[category.id]}
              </span>
            </div>
            <span className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "mt-auto h-8 w-full text-[11px]")}>
              Browse
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
