"use client";

import Link from "next/link";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import {
  CaraSetupChipEditor,
  type ChipBeforeAddResult,
} from "@/components/agent-knowledge/cara-setup-chip-editor";
import {
  buildCaraCapabilitiesFromPromptExtras,
  DETAILS_SURVEY_WARNING_MESSAGE,
  DETAILS_SURVEY_WARNING_THRESHOLD,
  looksLikeOpeningHours,
  looksLikeServiceExclusion,
  validateCallHandlingAdd,
  type CallHandlingInputKind,
} from "@/lib/call-handling-boundary";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import { dedupeCaraSetupChips } from "@/lib/cara-setup-chips";
import { cn } from "@/lib/utils";

type Props = {
  kind: CallHandlingInputKind;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  inputId: string;
  maxItems?: number;
  routes?: RoutingActionSummary[];
  transferNumber?: string;
  onMoveToServicesExclusion?: (item: string) => void;
  hideChipList?: boolean;
};

export function CallHandlingChipEditor({
  kind,
  value,
  onChange,
  placeholder,
  inputId,
  maxItems,
  routes,
  transferNumber,
  onMoveToServicesExclusion,
  hideChipList,
}: Props) {
  const skipWrongHomeRef = useRef<string | null>(null);
  const caps = buildCaraCapabilitiesFromPromptExtras(routes, transferNumber);

  function beforeAdd(item: string): ChipBeforeAddResult {
    if (
      kind === "rule" &&
      skipWrongHomeRef.current !== item &&
      looksLikeServiceExclusion(item)
    ) {
      return { outcome: "interrupt", kind: "exclusion-move", item };
    }

    if (
      kind === "rule" &&
      skipWrongHomeRef.current !== item &&
      looksLikeOpeningHours(item)
    ) {
      return { outcome: "interrupt", kind: "hours", item };
    }

    skipWrongHomeRef.current = null;

    const validation = validateCallHandlingAdd(item, kind, caps);
    if (!validation.ok) {
      return { outcome: "block", message: validation.block };
    }

    const warn = validation.warnings?.join(" ");
    return warn ? { outcome: "allow", warn } : { outcome: "allow" };
  }

  const surveyWarning =
    kind === "detail" && value.length >= DETAILS_SURVEY_WARNING_THRESHOLD
      ? DETAILS_SURVEY_WARNING_MESSAGE
      : null;

  return (
    <CaraSetupChipEditor
      inputId={inputId}
      placeholder={placeholder}
      value={value}
      onChange={(next) => onChange(dedupeCaraSetupChips(next))}
      maxItems={maxItems}
      beforeAdd={beforeAdd}
      listBanner={
        surveyWarning ? (
          <p className="text-[12.5px] text-amber-800">{surveyWarning}</p>
        ) : null
      }
      hideChipList={hideChipList}
      renderInterruptDialog={({
        kind: interruptKind,
        item,
        close,
        confirmAdd,
        clearDraft,
      }) => {
        if (interruptKind === "exclusion-move") {
          return (
            <Dialog open onOpenChange={(open) => !open && close()}>
              <DialogContent
                showCloseButton
                className="gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-md"
              >
                <DialogHeader className="space-y-0 px-5 pt-5 text-left">
                  <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
                    Sounds like something you don&apos;t offer
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
                    Move it to Services?
                  </DialogDescription>
                  <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-[#0b1220]">
                    {item}
                  </p>
                </DialogHeader>
                <DialogFooter className="flex-row flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={close}
                    className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      skipWrongHomeRef.current = item;
                      confirmAdd(item);
                      clearDraft();
                    }}
                    className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
                  >
                    Add anyway
                  </Button>
                  <Button
                    type="button"
                    disabled={!onMoveToServicesExclusion}
                    onClick={() => {
                      if (onMoveToServicesExclusion) {
                        onMoveToServicesExclusion(item);
                        clearDraft();
                      }
                      close();
                    }}
                    className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS)}
                  >
                    Move
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        }

        if (interruptKind === "hours") {
          return (
            <Dialog open onOpenChange={(open) => !open && close()}>
              <DialogContent
                showCloseButton
                className="gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-md"
              >
                <DialogHeader className="space-y-0 px-5 pt-5 text-left">
                  <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
                    Sounds like opening hours
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
                    Update them in General instead?
                  </DialogDescription>
                  <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-[#0b1220]">
                    {item}
                  </p>
                  <p className="mt-3 text-[13px]">
                    <Link
                      href="/dashboard/cara-setup/general"
                      className="font-medium text-[#0b1220] underline underline-offset-2"
                    >
                      Open General settings
                    </Link>
                  </p>
                </DialogHeader>
                <DialogFooter className="flex-row flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={close}
                    className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      skipWrongHomeRef.current = item;
                      confirmAdd(item);
                      clearDraft();
                    }}
                    className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
                  >
                    Add anyway
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        }

        return null;
      }}
    />
  );
}
