"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";

import { unlearnKnowledgeEntry } from "@/app/(dashboard)/dashboard/cara-knowledge/actions";
import {
  CaraKnowledgeSectionHeader,
} from "@/app/(dashboard)/dashboard/cara-knowledge/cara-knowledge-hub-shell";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  categoryLabel,
  searchCaraKnowledge,
  type CaraKnowledgeEntry,
  type CaraKnowledgeIndex,
} from "@/lib/cara-knowledge-index";
import { cn } from "@/lib/utils";

export function CaraKnowledgeUnlearnView({
  index,
}: {
  index: CaraKnowledgeIndex;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = useMemo(() => {
    const result = searchCaraKnowledge(index, query);
    return [...result.knows, ...result.related];
  }, [index, query]);

  const selected = matches.find((entry) => entry.id === selectedId) ?? null;

  return (
    <>
      <CaraKnowledgeSectionHeader
        title="Unlearn"
        description="Remove something Cara should no longer use."
      />

      <label className="relative mb-4 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedId(null);
            setError(null);
          }}
          placeholder="Search for knowledge to remove"
          className={cn(DASHBOARD_INPUT_CLASS, "pl-9")}
        />
      </label>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className={cn(DASHBOARD_CARD_SURFACE, "overflow-hidden")}>
          {!query.trim() ? (
            <p className="px-4 py-3 text-[13px] text-slate-500">
              Search for an answer, service, rule, or fact Cara currently knows.
            </p>
          ) : matches.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-slate-500">
              No matching knowledge found.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {matches.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(entry.id);
                      setError(null);
                    }}
                    className={cn(
                      "block w-full px-4 py-3 text-left transition-colors hover:bg-slate-50",
                      selectedId === entry.id && "bg-slate-50",
                    )}
                  >
                    <p className="text-[13px] font-medium text-[#0b1220]">
                      {entry.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-500">
                      {entry.body}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn(DASHBOARD_CARD_SURFACE, "p-4")}>
          {!selected ? (
            <p className="text-[13px] text-slate-500">
              Select an item to review what Cara currently knows before unlearning
              it.
            </p>
          ) : (
            <UnlearnReview
              entry={selected}
              error={error}
              pending={pending}
              onUnlearn={() => {
                setError(null);
                startTransition(async () => {
                  const result = await unlearnKnowledgeEntry(selected.id);
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  window.location.reload();
                });
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

function UnlearnReview({
  entry,
  error,
  pending,
  onUnlearn,
}: {
  entry: CaraKnowledgeEntry;
  error: string | null;
  pending: boolean;
  onUnlearn: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Review
        </p>
        <h2 className="mt-1 text-[15px] font-semibold text-[#0b1220]">
          {entry.title}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          {entry.body}
        </p>
      </div>
      <p className="text-[12px] text-slate-500">
        Category: {categoryLabel(entry.category)}
      </p>
      {entry.editHref ? (
        <Link
          href={entry.editHref}
          className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "inline-flex h-8 px-3 text-[11px]")}
        >
          {entry.editLabel ?? "Edit"}
        </Link>
      ) : null}
      {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={onUnlearn}
        className={cn(
          DASHBOARD_PRIMARY_BUTTON_CLASS,
          "h-9 w-full bg-red-700 text-[12px] hover:bg-red-800",
        )}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Unlearn this"}
      </button>
    </div>
  );
}
