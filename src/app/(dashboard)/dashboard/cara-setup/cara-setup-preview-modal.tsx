"use client";

import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DASHBOARD_SECONDARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import type { CaraOwnerPreview } from "@/lib/compile-cara-owner-preview";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: CaraOwnerPreview;
};

export function CaraSetupPreviewModal({ open, onOpenChange, preview }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,48rem)] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-none"
      >
        <DialogHeader className="space-y-0 border-b border-slate-100 px-6 pt-6 pb-4 text-left">
          <DialogTitle className="text-[17px] font-semibold tracking-tight text-[#0b1220]">
            In Cara&apos;s words
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-600">
            What Cara knows about your business — in her voice. Update your
            setup above and save to refresh this.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-4 font-sans text-[13px] leading-[1.65] text-[#0b1220] whitespace-pre-wrap">
            {preview.voice}
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                <Lock className="size-3.5" aria-hidden />
              </span>
              <p className="text-[13px] font-semibold text-[#0b1220]">
                Always the same on every call
              </p>
            </div>
            <p className="text-[12.5px] leading-relaxed text-slate-500">
              These can&apos;t be changed in setup — they keep callers and your
              business safe.
            </p>
            <ul className="space-y-2.5">
              {preview.locked.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <p className="text-[12.5px] font-semibold text-[#0b1220]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={DASHBOARD_SECONDARY_BUTTON_CLASS}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
