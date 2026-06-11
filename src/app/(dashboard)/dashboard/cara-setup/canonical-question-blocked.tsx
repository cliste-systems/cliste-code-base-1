"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import {
  canonicalQuestionNotice,
  type CanonicalQuestionMatch,
} from "@/lib/answers-boundary";
import { cn } from "@/lib/utils";

type Props = {
  question: string;
  match: CanonicalQuestionMatch;
  backLabel?: string;
  onBack: () => void;
};

/** Shown when a question is already answered from another Cara Setup tab. */
export function CanonicalQuestionBlocked({
  question,
  match,
  backLabel = "Go back",
  onBack,
}: Props) {
  return (
    <>
      <DialogHeader className="space-y-0 px-5 pt-5 text-left">
        <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
          Already covered in setup
        </DialogTitle>
        <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
          {canonicalQuestionNotice(match)}
        </DialogDescription>
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed text-[#0b1220]">
          {question}
        </p>
        <p className="mt-3 text-[12.5px] text-slate-500">
          Update it under{" "}
          <span className="font-medium text-[#0b1220]">{match.setupLabel}</span>{" "}
          instead — Cara won&apos;t use a separate answer here.
        </p>
      </DialogHeader>
      <DialogFooter className="mb-0 flex-row justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-white px-5 pt-4 pb-5">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
        >
          {backLabel}
        </Button>
        <Link
          href={match.setupHref}
          onClick={onBack}
          className={cn(
            DASHBOARD_PRIMARY_BUTTON_CLASS,
            "inline-flex h-10 items-center justify-center rounded-xl px-4 text-[13px] no-underline",
          )}
        >
          Open {match.setupLabel}
        </Link>
      </DialogFooter>
    </>
  );
}
