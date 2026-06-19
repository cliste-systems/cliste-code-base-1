"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";

import { partitionLintIssues } from "@/lib/cara-knowledge-lint";
import { cn } from "@/lib/utils";
import type { KnowledgeLintIssue } from "@/lib/cara-knowledge-lint";

type Props = {
  issues: KnowledgeLintIssue[];
  className?: string;
};

export function KnowledgeLintBanner({ issues, className }: Props) {
  if (issues.length === 0) return null;

  const { banner, inline } = partitionLintIssues(issues);
  const blockers = issues.filter((issue) => issue.severity === "block");
  const warnings = issues.filter((issue) => issue.severity !== "block");
  const isBlock = blockers.length > 0;
  const reviewCount = (isBlock ? blockers : warnings).length;
  const firstBanner = banner[0];

  if (reviewCount === 0) return null;

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border bg-white px-4 py-2.5",
        isBlock ? "border-red-200/90" : "border-slate-200",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        {isBlock ? (
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
        )}
        <div className="min-w-0">
          <p
            className={cn(
              "text-[13px] font-medium",
              isBlock ? "text-red-950" : "text-slate-800",
            )}
          >
            {isBlock
              ? `${reviewCount} issue${reviewCount === 1 ? "" : "s"} blocking save`
              : `${reviewCount} thing${reviewCount === 1 ? "" : "s"} to review`}
            {!isBlock && inline.length > 0 && banner.length === 0
              ? " — see hints below"
              : null}
          </p>
          {firstBanner && isBlock ? (
            <p className="mt-1 text-[12.5px] leading-relaxed text-red-800/90">
              {firstBanner.message}
            </p>
          ) : firstBanner && !isBlock && firstBanner.placement === "banner" ? (
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
              {firstBanner.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
