"use client";

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
  crossListConflictMessage,
  findExactInList,
  looksLikeExclusion,
  type ServiceListKind,
} from "@/lib/services-boundary";
import { cn } from "@/lib/utils";

type Props = {
  kind: ServiceListKind;
  value: string[];
  onChange: (next: string[]) => void;
  otherList: string[];
  onAddToOtherList?: (item: string) => void;
  placeholder: string;
  inputId: string;
};

export function ServicesBoundaryChipEditor({
  kind,
  value,
  onChange,
  otherList,
  onAddToOtherList,
  placeholder,
  inputId,
}: Props) {
  const skipNegationRef = useRef(false);

  function beforeAdd(item: string): ChipBeforeAddResult {
    if (findExactInList(item, otherList)) {
      return { outcome: "block", message: crossListConflictMessage(kind) };
    }

    if (
      kind === "offered" &&
      !skipNegationRef.current &&
      looksLikeExclusion(item)
    ) {
      return { outcome: "interrupt", kind: "negation", item };
    }

    skipNegationRef.current = false;
    return { outcome: "allow" };
  }

  return (
    <CaraSetupChipEditor
      inputId={inputId}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      beforeAdd={beforeAdd}
      nearDupLists={[otherList]}
      renderInterruptDialog={({
        kind: interruptKind,
        item,
        close,
        confirmAdd,
        clearDraft,
      }) => {
        if (interruptKind !== "negation") return null;
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
                  Move it to What you don&apos;t offer?
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
                    skipNegationRef.current = true;
                    confirmAdd(item);
                    clearDraft();
                  }}
                  className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
                >
                  Add anyway
                </Button>
                <Button
                  type="button"
                  disabled={!onAddToOtherList}
                  onClick={() => {
                    if (onAddToOtherList) {
                      onAddToOtherList(item);
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
      }}
    />
  );
}
