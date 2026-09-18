"use client";

import { useMemo } from "react";
import { Clock, Search, Timer } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DASHBOARD_EYEBROW_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  KnowledgeTemporalOverridePreview,
  KnowledgeTemporalStatusLine,
} from "@/components/cara-knowledge/knowledge-temporal-chrome";
import {
  dashboardQuickEnterVariants,
  dashboardStaggerVariants,
} from "@/components/dashboard/dashboard-motion";
import { Button } from "@/components/ui/button";
import type { CaraKnowledgeEntry } from "@/lib/cara-knowledge-index";
import { matchesKnowledgeSearchQuery } from "@/lib/cara-knowledge-index";
import {
  resolveTemporalLifecycle,
  type TemporalLifecycle,
  type TemporalUpdateRecord,
} from "@/lib/cara-knowledge-temporal";
import { cn } from "@/lib/utils";

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function lifecycleLabel(lifecycle: TemporalLifecycle): string {
  switch (lifecycle) {
    case "active":
      return "Live";
    case "scheduled":
      return "Scheduled";
    case "ended":
      return "Ended";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
  }
}

function lifecycleTone(lifecycle: TemporalLifecycle): string {
  switch (lifecycle) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "scheduled":
      return "border-sky-200 bg-sky-50 text-sky-900";
    default:
      return "border-[#dfe7e2] bg-[#f7faf8] text-[#4d5f58]";
  }
}

function recordToEntry(
  row: TemporalUpdateRecord,
  timezone: string,
): CaraKnowledgeEntry {
  return {
    id: `temporal-${row.id}`,
    category: "facts",
    title: row.title,
    body: row.body,
    source: "temporal",
    trainingItemId: row.trainingItemId,
    updatedAt: row.updatedAt,
    temporal: {
      updateId: row.id,
      durationMode: row.durationMode,
      effectiveAt: row.effectiveAt,
      expiresAt: row.expiresAt,
      timezone,
      overridePreview: row.overridePreview,
      replacesEntryId: row.subjectRef,
    },
  };
}

export function CaraKnowledgeTemporaryPanel({
  updates,
  timezone,
  canManage,
  query = "",
  onOpenEntry,
  onEndUpdate,
}: {
  updates: TemporalUpdateRecord[];
  timezone: string;
  canManage: boolean;
  query?: string;
  onOpenEntry: (entry: CaraKnowledgeEntry) => void;
  onEndUpdate: (entry: CaraKnowledgeEntry) => void;
}) {
  const reduceMotion = useReducedMotion();
  const trimmedQuery = query.trim();
  const filteredUpdates = useMemo(() => {
    if (!trimmedQuery) return updates;
    return updates.filter((row) =>
      matchesKnowledgeSearchQuery(trimmedQuery, row.title, row.body),
    );
  }, [trimmedQuery, updates]);

  const { live, past } = useMemo(() => {
    const liveRows: TemporalUpdateRecord[] = [];
    const pastRows: TemporalUpdateRecord[] = [];

    for (const row of filteredUpdates) {
      const lifecycle = resolveTemporalLifecycle(row);
      if (lifecycle === "active" || lifecycle === "scheduled") {
        liveRows.push(row);
      } else {
        pastRows.push(row);
      }
    }

    liveRows.sort(
      (a, b) =>
        new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime(),
    );
    pastRows.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return { live: liveRows, past: pastRows };
  }, [filteredUpdates]);

  if (updates.length === 0) {
    return (
      <EmptyState
        icon={Timer}
        title="No short-term updates yet"
        description="When you teach Cara something time-limited — like closing early today — it appears here while it is live and in the history below after it ends."
        className="py-14"
      />
    );
  }

  if (filteredUpdates.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title={`Nothing for now matching “${trimmedQuery}”`}
        description="Try different wording, or check What Cara knows for saved answers."
        className="py-14"
      />
    );
  }

  const List = reduceMotion ? "ul" : motion.ul;
  const Item = reduceMotion ? "li" : motion.li;
  const listMotion = reduceMotion
    ? {}
    : {
        variants: dashboardStaggerVariants,
        initial: "hidden" as const,
        animate: "show" as const,
      };
  const itemMotion = reduceMotion ? {} : { variants: dashboardQuickEnterVariants };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
      <div className="border-b border-[#dfe7e2] bg-[#fbfdfb] px-4 py-4 sm:px-5">
        <p className="text-[13px] leading-relaxed text-[#5b6b65]">
          Short-term facts Cara uses on calls right now — early closes, temporary
          answers, and promos. Ended updates stay below for reference.
        </p>
      </div>

      {live.length > 0 ? (
        <section>
          <p
            className={cn(
              DASHBOARD_EYEBROW_CLASS,
              "border-b border-[#e3e9e5] px-4 py-2.5 sm:px-5",
            )}
          >
            Live now
          </p>
          <List className="divide-y divide-[#e3e9e5]" {...listMotion}>
            {live.map((row) => {
              const entry = recordToEntry(row, timezone);
              const lifecycle = resolveTemporalLifecycle(row);
              return (
                <Item key={row.id} {...itemMotion}>
                  <TemporaryUpdateRow
                    entry={entry}
                    lifecycle={lifecycle}
                    canManage={canManage}
                    onOpen={() => onOpenEntry(entry)}
                    onEnd={() => onEndUpdate(entry)}
                  />
                </Item>
              );
            })}
          </List>
        </section>
      ) : (
        <p className="border-b border-[#e3e9e5] px-4 py-6 text-[13px] text-[#6b7c75] sm:px-5">
          Nothing live right now. Past updates are listed below.
        </p>
      )}

      {past.length > 0 ? (
        <section>
          <p
            className={cn(
              DASHBOARD_EYEBROW_CLASS,
              "border-b border-[#e3e9e5] px-4 py-2.5 sm:px-5",
            )}
          >
            Past updates
          </p>
          <List className="divide-y divide-[#e3e9e5]" {...listMotion}>
            {past.map((row) => {
              const entry = recordToEntry(row, timezone);
              const lifecycle = resolveTemporalLifecycle(row);
              const endedLabel =
                formatWhen(row.endedAt) ??
                formatWhen(row.expiresAt) ??
                formatWhen(row.cancelledAt) ??
                formatWhen(row.updatedAt);
              return (
                <Item key={row.id} {...itemMotion}>
                  <button
                    type="button"
                    onClick={() => onOpenEntry(entry)}
                    className="block w-full px-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#11181d] sm:px-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.04em]",
                              lifecycleTone(lifecycle),
                            )}
                          >
                            {lifecycleLabel(lifecycle)}
                          </span>
                        </div>
                        <p className="mt-2 text-[14px] font-medium leading-snug text-[#0b1220]">
                          {row.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-500">
                          {row.body}
                        </p>
                      </div>
                      {endedLabel ? (
                        <p className="shrink-0 text-[11px] text-slate-400">{endedLabel}</p>
                      ) : null}
                    </div>
                  </button>
                </Item>
              );
            })}
          </List>
        </section>
      ) : null}
    </div>
  );
}

function TemporaryUpdateRow({
  entry,
  lifecycle,
  canManage,
  onOpen,
  onEnd,
}: {
  entry: CaraKnowledgeEntry;
  lifecycle: TemporalLifecycle;
  canManage: boolean;
  onOpen: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#11181d] focus-visible:ring-offset-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.04em]",
                lifecycleTone(lifecycle),
              )}
            >
              {lifecycle === "scheduled" ? (
                <Clock className="size-3" aria-hidden />
              ) : (
                <Timer className="size-3" aria-hidden />
              )}
              {lifecycleLabel(lifecycle)}
            </span>
          </div>
          <p className="mt-2 text-[14px] font-medium leading-snug text-[#0b1220]">
            {entry.title}
          </p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-500">
            {entry.body}
          </p>
          <div className="mt-2">
            <KnowledgeTemporalStatusLine entry={entry} />
          </div>
        </button>
        {canManage && lifecycle !== "scheduled" ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 rounded-lg border-[#dfe7e2] px-3 text-[12px]"
            onClick={onEnd}
          >
            End now
          </Button>
        ) : null}
      </div>
      {entry.temporal?.overridePreview ? (
        <div className="mt-3 rounded-lg border border-[#e8eee9] bg-[#f8faf8] p-3">
          <KnowledgeTemporalOverridePreview preview={entry.temporal.overridePreview} />
        </div>
      ) : null}
    </div>
  );
}
