"use client";

import { cn } from "@/lib/utils";
import type { TransferVerdict } from "@/lib/transfer-capability-messages";

const TONE_STYLES: Record<
  TransferVerdict["tone"],
  { container: string; headline: string }
> = {
  green: {
    container: "border-emerald-200 bg-emerald-50/80",
    headline: "text-emerald-900",
  },
  amber: {
    container: "border-amber-200 bg-amber-50/80",
    headline: "text-amber-900",
  },
  grey: {
    container: "border-slate-200 bg-slate-50/80",
    headline: "text-slate-800",
  },
};

export function TransferVerdictBanner({
  verdict,
  children,
}: {
  verdict: TransferVerdict;
  children?: React.ReactNode;
}) {
  const styles = TONE_STYLES[verdict.tone];
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-sm",
        styles.container,
      )}
      role="status"
    >
      <p className={cn("font-medium", styles.headline)}>{verdict.headline}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {verdict.detail}
      </p>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
