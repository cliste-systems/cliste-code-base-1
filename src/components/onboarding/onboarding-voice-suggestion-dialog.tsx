"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  summary: string;
  introCurrent?: string;
  introSuggested?: string;
  closingCurrent?: string;
  closingSuggested?: string;
  pending?: boolean;
  onAccept: () => void;
  onKeep: () => void;
};

function ChangeRow({
  label,
  current,
  suggested,
}: {
  label: string;
  current: string;
  suggested: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-500 line-through decoration-slate-300">
        {current}
      </p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-[#0b1220]">
        {suggested}
      </p>
    </div>
  );
}

export function OnboardingVoiceSuggestionDialog({
  open,
  summary,
  introCurrent,
  introSuggested,
  closingCurrent,
  closingSuggested,
  pending = false,
  onAccept,
  onKeep,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onKeep()}>
      <DialogContent
        showCloseButton={!pending}
        className="gap-5 rounded-2xl border-slate-200/80 bg-white p-5 sm:max-w-md"
        overlayClassName="bg-black/25 backdrop-blur-[2px]"
      >
        <DialogHeader className="gap-1.5 text-left">
          <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
            Cara spotted a potential issue
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-slate-600">
            {summary}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          {introSuggested && introCurrent ? (
            <ChangeRow
              label="Opening line"
              current={introCurrent}
              suggested={introSuggested}
            />
          ) : null}
          {closingSuggested && closingCurrent ? (
            <ChangeRow
              label="Closing line"
              current={closingCurrent}
              suggested={closingSuggested}
            />
          ) : null}
        </div>

        <DialogFooter className="-mx-5 -mb-5 gap-2 border-t border-slate-100 bg-transparent p-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={onKeep}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center justify-center rounded-full px-5",
              "text-[14px] font-medium text-slate-600 transition-colors hover:text-[#0b1220]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            Keep mine
          </button>
          <OnboardingPrimaryButton
            type="button"
            pending={pending}
            onClick={onAccept}
            className="h-10 px-6"
          >
            {pending ? "Saving…" : "Use suggestion"}
          </OnboardingPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
