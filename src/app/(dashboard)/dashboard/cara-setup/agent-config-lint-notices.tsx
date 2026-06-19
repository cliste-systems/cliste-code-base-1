"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";

import { KnowledgeLintIssueList } from "@/components/cara-knowledge/knowledge-lint-issue-list";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { KnowledgeLintIssue } from "@/lib/cara-knowledge-lint";

type AgentConfigLintNoticesProps = {
  issues: KnowledgeLintIssue[];
  sessionKey: string;
  dialogTitle: string;
  dialogDescription: string;
  className?: string;
};

function readIntroDismissed(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function AgentConfigLintNotices({
  issues,
  sessionKey,
  dialogTitle,
  dialogDescription,
  className,
}: AgentConfigLintNoticesProps) {
  const [open, setOpen] = useState(false);
  const [introDismissed, setIntroDismissed] = useState<boolean | null>(null);
  const introCheckedRef = useRef(false);

  useEffect(() => {
    setIntroDismissed(readIntroDismissed(sessionKey));
  }, [sessionKey]);

  useEffect(() => {
    if (introCheckedRef.current || introDismissed === null) return;
    if (issues.length === 0) return;

    introCheckedRef.current = true;
    if (!introDismissed) {
      setOpen(true);
    }
  }, [introDismissed, issues.length]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {
        /* ignore */
      }
      setIntroDismissed(true);
    }
  }

  if (issues.length === 0) return null;

  const isBlock = issues.some((issue) => issue.severity === "block");
  const showCompact = introDismissed === true && !open;

  return (
    <>
      {showCompact ? (
        <div className={cn("mb-3", className)}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg text-[12.5px] font-medium transition-colors",
              isBlock
                ? "text-red-800 hover:text-red-950"
                : "text-slate-700 hover:text-slate-900",
            )}
          >
            {isBlock ? (
              <AlertCircle className="size-3.5 shrink-0 text-red-600" aria-hidden />
            ) : (
              <AlertTriangle className="size-3.5 shrink-0 text-slate-500" aria-hidden />
            )}
            {isBlock
              ? `${issues.filter((i) => i.severity === "block").length} issue${
                  issues.filter((i) => i.severity === "block").length === 1 ? "" : "s"
                } blocking save`
              : `${issues.length} item${issues.length === 1 ? "" : "s"} to review`}
            <span className="text-slate-400">·</span>
            <span className="underline underline-offset-2">Show</span>
          </button>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
            <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
              {isBlock ? "Fix these before saving" : dialogTitle}
            </DialogTitle>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              {dialogDescription}
            </p>
          </DialogHeader>
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto px-5 py-3">
            <KnowledgeLintIssueList issues={issues} />
          </div>
          <div className="border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="w-full rounded-lg bg-[#0b1220] px-3 py-2 text-[13px] font-medium text-white"
            >
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
