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
  /** Standalone = above page content; inset = top strip inside a SectionCard body. */
  variant?: "standalone" | "inset";
  importError?: string | null;
  onImportErrorHandled?: () => void;
};

function readIntroDismissed(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function compactSummary(issues: KnowledgeLintIssue[], isBlock: boolean): string {
  if (isBlock) {
    const count = issues.filter((issue) => issue.severity === "block").length;
    return `${count} issue${count === 1 ? "" : "s"} blocking save`;
  }
  return `${issues.length} item${issues.length === 1 ? "" : "s"} to review`;
}

export function AgentConfigLintNotices({
  issues,
  sessionKey,
  dialogTitle,
  dialogDescription,
  className,
  variant = "standalone",
  importError = null,
  onImportErrorHandled,
}: AgentConfigLintNoticesProps) {
  const [open, setOpen] = useState(false);
  const [introDismissed, setIntroDismissed] = useState<boolean | null>(null);
  const introCheckedRef = useRef(false);

  useEffect(() => {
    setIntroDismissed(readIntroDismissed(sessionKey));
  }, [sessionKey]);

  useEffect(() => {
    if (importError) {
      setOpen(true);
      return;
    }

    if (introCheckedRef.current || introDismissed === null) return;
    if (issues.length === 0) return;

    introCheckedRef.current = true;
    if (!introDismissed) {
      setOpen(true);
    }
  }, [importError, introDismissed, issues.length]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      if (importError) {
        onImportErrorHandled?.();
      } else {
        try {
          sessionStorage.setItem(sessionKey, "1");
        } catch {
          /* ignore */
        }
        setIntroDismissed(true);
      }
    }
  }

  const hasLintIssues = issues.length > 0;
  if (!hasLintIssues && !importError) return null;

  const isBlock = issues.some((issue) => issue.severity === "block");
  const showCompact =
    (introDismissed === true || Boolean(importError)) &&
    !open &&
    (hasLintIssues || Boolean(importError));

  const resolvedDialogTitle = importError
    ? "Couldn't import"
    : isBlock
      ? "Fix these before saving"
      : dialogTitle;

  return (
    <>
      {showCompact ? (
        <div
          className={cn(
            variant === "inset"
              ? "border-b border-slate-200 px-5 py-2.5"
              : "mb-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5",
            className,
          )}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex w-full items-center gap-2 text-left text-[12.5px] font-medium transition-colors",
              isBlock
                ? "text-[#353D42] hover:text-[#11181d]"
                : "text-slate-700 hover:text-slate-900",
            )}
          >
            {isBlock ? (
              <AlertCircle className="size-3.5 shrink-0 text-[#353D42]" aria-hidden />
            ) : (
              <AlertTriangle className="size-3.5 shrink-0 text-slate-500" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              {importError ? "Import failed" : compactSummary(issues, isBlock)}
            </span>
            <span className="shrink-0 text-slate-400">·</span>
            <span className="shrink-0 underline underline-offset-2">Show</span>
          </button>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
            <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
              {resolvedDialogTitle}
            </DialogTitle>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              {importError ?? dialogDescription}
            </p>
          </DialogHeader>
          {!importError && hasLintIssues ? (
            <div className="max-h-[min(24rem,60vh)] overflow-y-auto px-5 py-3">
              <KnowledgeLintIssueList issues={issues} />
            </div>
          ) : null}
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
