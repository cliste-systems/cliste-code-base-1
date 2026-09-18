"use client";

import { useMemo } from "react";
import { Search, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DASHBOARD_EYEBROW_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  dashboardQuickEnterVariants,
  dashboardStaggerVariants,
} from "@/components/dashboard/dashboard-motion";
import {
  knowledgeEntriesForBrowse,
  searchCaraKnowledge,
  sortKnowledgeEntries,
  type CaraKnowledgeEntry,
  type CaraKnowledgeIndex,
} from "@/lib/cara-knowledge-index";
import { cn } from "@/lib/utils";

import { KnowledgeEntryRow } from "./cara-knowledge-browse-view";

export function CaraKnowledgeKnowsPanel({
  index,
  canManage,
  query,
  onOpenEntry,
  onUnlearnEntry,
  onOpenLinkedTemporal,
  onTeachSuggestion,
}: {
  index: CaraKnowledgeIndex;
  canManage: boolean;
  query: string;
  onOpenEntry: (entry: CaraKnowledgeEntry) => void;
  onUnlearnEntry: (entry: CaraKnowledgeEntry) => void;
  onOpenLinkedTemporal?: (updateId: string) => void;
  onTeachSuggestion?: (text: string) => void;
}) {
  const trimmed = query.trim();
  const results = useMemo(
    () => searchCaraKnowledge(index, query),
    [index, query],
  );
  const saved = useMemo(
    () =>
      sortKnowledgeEntries(
        knowledgeEntriesForBrowse([...results.knows, ...results.related]),
      ),
    [results.knows, results.related],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {!trimmed ? (
          <div className="flex h-full min-h-[240px] items-center justify-center px-4 py-10 sm:px-5">
            <EmptyState
              icon={Sparkles}
              title="Find what Cara knows"
              description="Use the search box above. Matching answers appear here so you can review, edit, or unlearn them."
              className="max-w-md py-8"
            />
          </div>
        ) : saved.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={Search}
              title={`Nothing saved for “${trimmed}”`}
              description="Cara doesn’t have a saved answer for this yet."
              className="py-8"
            />
            {canManage && onTeachSuggestion ? (
              <p className="text-center">
                <button
                  type="button"
                  onClick={() => onTeachSuggestion(trimmed)}
                  className="text-[13px] font-medium text-[#11181d] underline-offset-2 hover:underline"
                >
                  Teach Cara about this
                </button>
              </p>
            ) : null}
          </div>
        ) : (
          <KnowsSearchResults
            saved={saved}
            canManage={canManage}
            onOpenEntry={onOpenEntry}
            onUnlearnEntry={onUnlearnEntry}
            onOpenLinkedTemporal={onOpenLinkedTemporal}
          />
        )}
      </div>
    </div>
  );
}

function KnowsSearchResults({
  saved,
  canManage,
  onOpenEntry,
  onUnlearnEntry,
  onOpenLinkedTemporal,
}: {
  saved: CaraKnowledgeEntry[];
  canManage: boolean;
  onOpenEntry: (entry: CaraKnowledgeEntry) => void;
  onUnlearnEntry: (entry: CaraKnowledgeEntry) => void;
  onOpenLinkedTemporal?: (updateId: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const SavedList = reduceMotion ? "ul" : motion.ul;
  const SavedItem = reduceMotion ? "li" : motion.li;
  const listMotion = reduceMotion
    ? {}
    : {
        variants: dashboardStaggerVariants,
        initial: "hidden" as const,
        animate: "show" as const,
      };
  const itemMotion = reduceMotion ? {} : { variants: dashboardQuickEnterVariants };

  return (
    <section>
      <p
        className={cn(
          DASHBOARD_EYEBROW_CLASS,
          "border-b border-[#e3e9e5] px-4 py-2.5 sm:px-5",
        )}
      >
        What Cara knows
      </p>
      <SavedList className="divide-y divide-[#e3e9e5]" {...listMotion}>
        {saved.map((entry) => (
          <SavedItem key={entry.id} {...itemMotion}>
            <KnowledgeEntryRow
              entry={entry}
              canManage={canManage}
              onOpen={() => onOpenEntry(entry)}
              onUnlearn={() => onUnlearnEntry(entry)}
              onOpenLinkedTemporal={onOpenLinkedTemporal}
            />
          </SavedItem>
        ))}
      </SavedList>
    </section>
  );
}
