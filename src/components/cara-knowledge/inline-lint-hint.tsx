"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

import type { KnowledgeLintIssue } from "@/lib/cara-knowledge-lint";
import { cn } from "@/lib/utils";

const DISMISS_PREFIX = "cliste:lint-hint-dismissed:";

function readDismissed(id: string): boolean {
  try {
    return sessionStorage.getItem(`${DISMISS_PREFIX}${id}`) === "1";
  } catch {
    return false;
  }
}

function dismissHint(id: string) {
  try {
    sessionStorage.setItem(`${DISMISS_PREFIX}${id}`, "1");
  } catch {
    /* ignore */
  }
}

type Props = {
  issue: KnowledgeLintIssue;
  className?: string;
  onAddFaq?: (sourceText: string) => void;
};

export function InlineLintHint({ issue, className, onAddFaq }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed(issue.id));
  }, [issue.id]);

  if (dismissed) return null;

  const isBlock = issue.severity === "block";

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg px-2 py-1.5",
        isBlock ? "bg-red-50/80 text-red-900" : "bg-slate-50/90 text-slate-600",
        className,
      )}
      role="note"
    >
      <p className="min-w-0 flex-1 text-[12px] leading-relaxed">{issue.message}</p>
      <div className="flex shrink-0 items-center gap-1.5">
        {issue.action === "add_faq" && issue.sourceText && onAddFaq ? (
          <button
            type="button"
            onClick={() => onAddFaq(issue.sourceText!)}
            className="text-[12px] font-medium text-[#0b1220] underline underline-offset-2"
          >
            Add as FAQ
          </button>
        ) : issue.href ? (
          <Link
            href={issue.href}
            className="text-[12px] font-medium text-[#0b1220] underline underline-offset-2"
          >
            Review
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => {
            dismissHint(issue.id);
            setDismissed(true);
          }}
          className="rounded p-0.5 text-slate-400 hover:text-slate-600"
          aria-label="Dismiss hint"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
