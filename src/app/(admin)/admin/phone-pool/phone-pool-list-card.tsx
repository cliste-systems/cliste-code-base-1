"use client";

import { useState, useTransition, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { AdminListCard } from "@/components/admin/admin-list-card";
import { cn } from "@/lib/utils";

import { triggerPhonePoolRefill } from "./actions";

export function PhonePoolListCard({
  countLabel,
  stats,
  notice,
  children,
}: {
  countLabel: string;
  stats?: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    tone: "info" | "error";
    message: string;
  } | null>(null);

  const button = (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          setFeedback(null);
          try {
            const r = await triggerPhonePoolRefill();
            const message =
              r.purchased > 0
                ? `Purchased ${r.purchased} number${r.purchased === 1 ? "" : "s"}.`
                : r.skippedReason
                  ? `No action needed — ${r.skippedReason}`
                  : "No action needed.";
            setFeedback({ tone: "info", message });
            router.refresh();
          } catch (e) {
            setFeedback({
              tone: "error",
              message: e instanceof Error ? e.message : "Refill failed.",
            });
          }
        })
      }
      className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw
        className={cn("size-3.5", pending && "animate-spin")}
        aria-hidden
      />
      {pending ? "Refilling…" : "Trigger refill now"}
    </button>
  );

  const feedbackBanner = feedback ? (
    <p
      role="status"
      className={cn(
        "text-sm",
        feedback.tone === "error" ? "text-red-800" : "text-gray-700",
      )}
    >
      {feedback.message}
    </p>
  ) : null;

  const banner = feedbackBanner ?? notice ?? null;

  return (
    <AdminListCard
      countLabel={countLabel}
      toolbar={button}
      stats={stats}
      banner={banner}
    >
      {children}
    </AdminListCard>
  );
}
