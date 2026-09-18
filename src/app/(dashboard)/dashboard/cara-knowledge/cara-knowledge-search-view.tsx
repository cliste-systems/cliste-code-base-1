"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import {
  CaraKnowledgeSectionHeader,
} from "@/app/(dashboard)/dashboard/cara-knowledge/cara-knowledge-hub-shell";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_INPUT_CLASS,
} from "@/components/dashboard/dashboard-surface";
import type { CaraKnowledgeIndex } from "@/lib/cara-knowledge-index";
import { searchCaraKnowledge } from "@/lib/cara-knowledge-index";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

export function CaraKnowledgeSearchView({
  index,
}: {
  index: CaraKnowledgeIndex;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchCaraKnowledge(index, query),
    [index, query],
  );

  return (
    <>
      <CaraKnowledgeSectionHeader
        title="Search Cara's knowledge"
        description="Search anything to see whether Cara knows it."
      />

      <label className="relative mb-4 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Try "communion cakes" or "Real Rewards"'
          className={cn(DASHBOARD_INPUT_CLASS, "pl-9")}
        />
      </label>

      {!query.trim() ? (
        <div className={cn(DASHBOARD_CARD_SURFACE, "p-4 text-[13px] text-slate-500")}>
          Start typing to see whether Cara knows it, what is related, and any open
          gaps from recent calls.
        </div>
      ) : (
        <div className="space-y-4">
          <SearchResultGroup
            title="Knows it"
            empty="No exact match in Cara's active knowledge."
            items={results.knows.map((entry) => ({
              key: entry.id,
              title: entry.title,
              body: entry.body,
              href: entry.editHref,
            }))}
          />
          <SearchResultGroup
            title="Related knowledge"
            empty="No related matches."
            items={results.related.map((entry) => ({
              key: entry.id,
              title: entry.title,
              body: entry.body,
              href: entry.editHref,
            }))}
          />
          <SearchResultGroup
            title="Doesn't know it yet"
            empty="No open gap matches this search."
            items={results.gaps.map((gap) => ({
              key: gap.id,
              title: gap.gap_summary,
              body: gap.cara_question,
              href: DASHBOARD_ROUTES.caraKnowledgeNeedsInputItem(gap.id),
            }))}
            footer={
              results.knows.length === 0 && results.gaps.length === 0 ? (
                <Link
                  href={`${DASHBOARD_ROUTES.caraKnowledgeTeach}?q=${encodeURIComponent(query)}`}
                  className="text-[12px] font-medium text-slate-700 underline-offset-2 hover:underline"
                >
                  Teach Cara about this
                </Link>
              ) : null
            }
          />
        </div>
      )}
    </>
  );
}

function SearchResultGroup({
  title,
  empty,
  items,
  footer,
}: {
  title: string;
  empty: string;
  items: { key: string; title: string; body: string; href?: string }[];
  footer?: React.ReactNode;
}) {
  return (
    <section className={cn(DASHBOARD_CARD_SURFACE, "overflow-hidden")}>
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-[14px] font-semibold text-[#0b1220]">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.key} className="px-4 py-3">
              {item.href ? (
                <Link href={item.href} className="block hover:bg-slate-50/80">
                  <p className="text-[13px] font-medium text-[#0b1220]">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-500">
                    {item.body}
                  </p>
                </Link>
              ) : (
                <>
                  <p className="text-[13px] font-medium text-[#0b1220]">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-500">
                    {item.body}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {footer ? <div className="border-t border-slate-100 px-4 py-3">{footer}</div> : null}
    </section>
  );
}
