"use client";

import Link from "next/link";

import type { CaraTrainingGapItem } from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  organizationId: string;
  gaps: CaraTrainingGapItem[];
};

export function KnowledgeGapsSection({ organizationId, gaps }: Props) {
  return (
    <SectionCard
      title="9. Knowledge gaps"
      description="Open gaps from live calls. Learnable gaps can be answered in the tenant dashboard."
    >
      {gaps.length === 0 ? (
        <p className="text-muted-foreground text-sm">No open knowledge gaps.</p>
      ) : (
        <ul className="space-y-2">
          {gaps.map((gap) => (
            <li
              key={gap.id}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    gap.gapKind === "live_info"
                      ? "rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700"
                      : "rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-800"
                  }
                >
                  {gap.gapKind === "live_info" ? "Live info" : "Learnable"}
                </span>
                <span className="text-muted-foreground text-xs">
                  ×{gap.occurrenceCount}
                </span>
              </div>
              <p className="mt-1 font-medium text-slate-900">{gap.gapSummary}</p>
              <p className="text-muted-foreground text-xs">{gap.caraQuestion}</p>
              {gap.gapKind === "live_info" ? (
                <p className="mt-1 text-xs text-amber-800">
                  Read-only — stock, prices, and live shelf info cannot be taught
                  from here.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-xs">
        Answer learnable gaps in the{" "}
        <Link
          href={`/dashboard/cara-training`}
          className="font-medium text-slate-700 underline"
        >
          tenant Cara training inbox
        </Link>{" "}
        (org {organizationId.slice(0, 8)}…).
      </p>
    </SectionCard>
  );
}
