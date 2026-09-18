"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { EmptyState } from "@/components/dashboard/empty-state";
import type { CaraKnowledgeHistoryItem } from "@/lib/cara-knowledge-history-build";
import { filterCaraKnowledgeHistoryItems } from "@/lib/cara-knowledge-history-build";
import {
  historyActionTone,
} from "@/lib/cara-knowledge-history-labels";
import {
  dashboardQuickEnterVariants,
  dashboardStaggerVariants,
} from "@/components/dashboard/dashboard-motion";
import { cn } from "@/lib/utils";

function formatHistoryWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CaraKnowledgeHistoryPanel({
  items,
  query = "",
  emptyMessage = "No history yet. When Cara learns something, you teach her, or you update Business profile, it will appear here.",
}: {
  items: CaraKnowledgeHistoryItem[];
  query?: string;
  emptyMessage?: string;
}) {
  const reduceMotion = useReducedMotion();
  const visibleItems = useMemo(
    () => filterCaraKnowledgeHistoryItems(items, query),
    [items, query],
  );
  const trimmedQuery = query.trim();

  if (items.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-[13px] text-slate-500 sm:px-5">
        {emptyMessage}
      </p>
    );
  }

  if (visibleItems.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title={`Nothing in history for “${trimmedQuery}”`}
        description="Try different wording, or check What Cara knows if you already taught this."
        className="py-12"
      />
    );
  }

  const List = reduceMotion ? "ul" : motion.ul;
  const Item = reduceMotion ? "li" : motion.li;

  return (
    <List
      className="divide-y divide-[#e3e9e5]"
      {...(reduceMotion
        ? {}
        : {
            variants: dashboardStaggerVariants,
            initial: "hidden" as const,
            animate: "show" as const,
          })}
    >
      {visibleItems.map((item) => (
        <Item
          key={item.id}
          className="px-4 py-4 sm:px-5"
          {...(reduceMotion ? {} : { variants: dashboardQuickEnterVariants })}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.04em]",
                    historyActionTone(item.kind, item.source),
                  )}
                >
                  {item.actionLabel}
                </span>
                {item.categoryLabel ? (
                  <span className="inline-flex rounded-full border border-[#dfe7e2] bg-[#f7faf8] px-2.5 py-0.5 text-[10px] font-medium text-[#4d5f58]">
                    {item.categoryLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[14px] font-medium leading-snug text-[#0b1220]">
                {item.title}
              </p>
              {item.subtitle ? (
                <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-500">
                  {item.subtitle}
                </p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-slate-400">{formatHistoryWhen(item.createdAt)}</p>
              {item.sourceHint ? (
                <p className="mt-1 text-[11px] text-slate-400">{item.sourceHint}</p>
              ) : null}
            </div>
          </div>
        </Item>
      ))}
    </List>
  );
}
