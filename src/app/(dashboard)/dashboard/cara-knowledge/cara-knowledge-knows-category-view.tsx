import Link from "next/link";

import {
  CaraKnowledgeHomeLink,
  CaraKnowledgeSectionHeader,
} from "@/app/(dashboard)/dashboard/cara-knowledge/cara-knowledge-hub-shell";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  categoryLabel,
  entriesForCategory,
  type CaraKnowledgeIndex,
} from "@/lib/cara-knowledge-index";
import type { CaraKnowledgeCategoryId } from "@/lib/cara-knowledge-sections";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

export function CaraKnowledgeKnowsCategoryView({
  index,
  category,
}: {
  index: CaraKnowledgeIndex;
  category: CaraKnowledgeCategoryId;
}) {
  const entries = entriesForCategory(index, category);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <CaraKnowledgeSectionHeader
          title={categoryLabel(category)}
          description="Active knowledge Cara can use on calls."
        />
        <CaraKnowledgeHomeLink />
      </div>

      {entries.length === 0 ? (
        <div className={cn(DASHBOARD_CARD_SURFACE, "p-4 text-[13px] text-slate-500")}>
          Nothing here yet. Teach Cara or update your Business setup to add this
          kind of knowledge.
        </div>
      ) : (
        <div className={cn(DASHBOARD_CARD_SURFACE, "overflow-hidden")}>
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <li key={entry.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#0b1220]">
                      {entry.title}
                    </p>
                    <p className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-slate-500">
                      {entry.body}
                    </p>
                  </div>
                  {entry.editHref ? (
                    <Link
                      href={entry.editHref}
                      className={cn(
                        DASHBOARD_SECONDARY_BUTTON_CLASS,
                        "h-8 shrink-0 px-3 text-[11px]",
                      )}
                    >
                      {entry.editLabel ?? "Edit"}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={DASHBOARD_ROUTES.caraKnowledgeTeach}
          className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "h-9 px-4 text-[12px]")}
        >
          Teach Cara
        </Link>
        <Link
          href={DASHBOARD_ROUTES.caraKnowledgeKnows}
          className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "h-9 px-4 text-[12px]")}
        >
          All categories
        </Link>
      </div>
    </>
  );
}
