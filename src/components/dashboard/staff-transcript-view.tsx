import { useMemo } from "react";

import { parseTranscriptTurns } from "@/lib/transcript-display";
import { cn } from "@/lib/utils";

type StaffTranscriptViewProps = {
  text: string;
  className?: string;
  scrollable?: boolean;
};

export function StaffTranscriptView({
  text,
  className,
  scrollable = false,
}: StaffTranscriptViewProps) {
  const turns = useMemo(() => parseTranscriptTurns(text), [text]);
  const structured = turns.some((turn) => turn.speaker != null);

  const shellClassName = cn(
    "rounded-lg border border-[#d9e2dd] bg-white p-4 shadow-inner",
    scrollable && "max-h-[min(42vh,360px)] overflow-y-auto overscroll-y-contain",
    className,
  );

  if (turns.length === 0) {
    return null;
  }

  if (!structured) {
    return (
      <div
        className={cn(
          shellClassName,
          "text-[14px] leading-[1.7] whitespace-pre-wrap text-slate-700",
        )}
      >
        {text}
      </div>
    );
  }

  return (
    <div className={cn(shellClassName, "space-y-5")}>
      {turns.map((turn, index) => (
        <div key={`${turn.speaker ?? "line"}-${index}`} className="space-y-1.5">
          {turn.speaker ? (
            <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
              {turn.speaker}
            </p>
          ) : null}
          <p className="text-[14px] leading-[1.65] whitespace-pre-wrap text-slate-700">
            {turn.text.trim()}
          </p>
        </div>
      ))}
    </div>
  );
}
