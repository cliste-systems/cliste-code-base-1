"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";

import {
  moveDetailsCollectItem,
  type DetailsCollectMode,
} from "@/lib/details-collect-mode";
import { cn } from "@/lib/utils";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";

import { CallHandlingChipEditor } from "./call-handling-chip-editor";

type Props = {
  inputId: string;
  items: string[];
  onItemsChange: (next: string[]) => void;
  mode: DetailsCollectMode;
  onModeChange: (mode: DetailsCollectMode) => void;
  placeholder: string;
  maxItems?: number;
  routes?: RoutingActionSummary[];
  transferNumber?: string;
};

export function DetailsToCollectEditor({
  inputId,
  items,
  onItemsChange,
  mode,
  onModeChange,
  placeholder,
  maxItems = 12,
  routes,
  transferNumber,
}: Props) {
  const showModeChoice = items.length > 0;
  const showOrderList = mode === "fixed" && items.length > 0;

  return (
    <div className="space-y-4">
      <CallHandlingChipEditor
        kind="detail"
        inputId={inputId}
        value={items}
        onChange={onItemsChange}
        placeholder={placeholder}
        maxItems={maxItems}
        routes={routes}
        transferNumber={transferNumber}
        hideChipList={showOrderList}
      />

      {showModeChoice ? (
        <div className="space-y-2">
          <p className="text-[12.5px] font-medium text-slate-700">
            How should Cara ask for these?
          </p>
          <div
            className="inline-flex rounded-xl border border-slate-200/90 bg-slate-50/80 p-1"
            role="radiogroup"
            aria-label="Details collection order"
          >
            <ModeOption
              selected={mode === "conversational"}
              onSelect={() => onModeChange("conversational")}
              label="Let Cara decide from the conversation"
            />
            <ModeOption
              selected={mode === "fixed"}
              onSelect={() => onModeChange("fixed")}
              label="Ask in a set order"
            />
          </div>
        </div>
      ) : null}

      {showOrderList ? (
        <div className="space-y-2">
          <p className="text-[12.5px] text-slate-600">
            Cara asks for these after name and number, top to bottom.
          </p>
          <ol className="space-y-2" aria-label="Details collection order">
            {items.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-[#0b1220]">
                  {item}
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() =>
                      onItemsChange(moveDetailsCollectItem(items, index, -1))
                    }
                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Move ${item} up`}
                  >
                    <ChevronUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    onClick={() =>
                      onItemsChange(moveDetailsCollectItem(items, index, 1))
                    }
                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Move ${item} down`}
                  >
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onItemsChange(items.filter((_, i) => i !== index))
                    }
                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`Remove ${item}`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function ModeOption({
  selected,
  onSelect,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "rounded-lg px-3 py-2 text-left text-[12.5px] font-medium transition-colors",
        selected
          ? "bg-white text-[#0b1220] shadow-sm"
          : "text-slate-600 hover:text-slate-800",
      )}
    >
      {label}
    </button>
  );
}
