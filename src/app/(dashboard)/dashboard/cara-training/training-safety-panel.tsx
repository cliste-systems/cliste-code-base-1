"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

import type { TrainingSafetyIssue } from "@/lib/cara-training-safety-eval";
import { cn } from "@/lib/utils";

export function TrainingSafetyPanel({
  issues,
  className,
}: {
  issues: TrainingSafetyIssue[];
  className?: string;
}) {
  if (issues.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-red-200 bg-red-50/80 p-4",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-red-950">
            Can&apos;t save this yet
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-red-800/90">
            Cara would get conflicting or unsafe instructions on calls. Fix
            these before saving.
          </p>
          <ul className="mt-3 space-y-2">
            {issues.map((issue) => (
              <li
                key={`${issue.id}:${issue.message}`}
                className="text-[13px] leading-relaxed text-red-900"
              >
                {issue.message}
                {issue.href ? (
                  <>
                    {" "}
                    <Link
                      href={issue.href}
                      className="font-medium underline underline-offset-2"
                    >
                      Open in setup
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
