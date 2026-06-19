"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { KnowledgeLintIssueList } from "@/components/cara-knowledge/knowledge-lint-issue-list";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { useServicesPageLintIssues } from "./use-agent-config-lint-issues";

const INTRO_DISMISSED_KEY = "cliste:dashboard:business-services:lint-intro-dismissed";

type Props = {
  importError: string | null;
  onImportErrorHandled: () => void;
};

function readIntroDismissed(): boolean {
  try {
    return sessionStorage.getItem(INTRO_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function ServicesLintNotices({
  importError,
  onImportErrorHandled,
}: Props) {
  const issues = useServicesPageLintIssues();
  const [open, setOpen] = useState(false);
  const [introDismissed, setIntroDismissed] = useState<boolean | null>(null);
  const introCheckedRef = useRef(false);

  useEffect(() => {
    setIntroDismissed(readIntroDismissed());
  }, []);

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
        onImportErrorHandled();
      } else {
        try {
          sessionStorage.setItem(INTRO_DISMISSED_KEY, "1");
        } catch {
          /* ignore */
        }
        setIntroDismissed(true);
      }
    }
  }

  const showCompact =
    introDismissed === true && !importError && issues.length > 0 && !open;

  const dialogTitle = importError
    ? "Couldn't import"
    : issues.some((issue) => issue.severity === "block")
      ? "Fix these before saving"
      : "Review your service menu";

  return (
    <>
      {showCompact ? (
        <div className="border-b border-slate-200 px-5 py-2.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg text-[12.5px] font-medium text-slate-700 transition-colors hover:text-slate-900"
          >
            <AlertTriangle className="size-3.5 text-slate-500" aria-hidden />
            {issues.length} item{issues.length === 1 ? "" : "s"} to review
            <span className="text-slate-400">·</span>
            <span className="underline underline-offset-2">Show</span>
          </button>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
            <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
              {dialogTitle}
            </DialogTitle>
            {importError ? (
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                {importError}
              </p>
            ) : (
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                A few things to tidy up so Cara stays accurate on calls.
              </p>
            )}
          </DialogHeader>
          {!importError && issues.length > 0 ? (
            <div className="max-h-[min(24rem,60vh)] overflow-y-auto px-5 py-3">
              <KnowledgeLintIssueList issues={issues} />
            </div>
          ) : null}
          <div className="border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className={cn(
                "w-full rounded-lg bg-[#0b1220] px-3 py-2 text-[13px] font-medium text-white",
              )}
            >
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
