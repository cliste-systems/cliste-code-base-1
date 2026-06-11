import {
  STATUS_BADGE_CLASSES,
  STATUS_DOT_CLASSES,
  type StatusVariant,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

type StatusPillProps = {
  children: React.ReactNode;
  /** Quiet, meaning-only colour. Defaults to neutral slate. */
  variant?: StatusVariant;
  /** Show a small leading status dot. */
  dot?: boolean;
  className?: string;
};

/** Outcome / status chip. Neutral by default; colour only conveys meaning. */
export function StatusPill({
  children,
  variant = "neutral",
  dot = false,
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        STATUS_BADGE_CLASSES[variant],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            STATUS_DOT_CLASSES[variant],
          )}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}
