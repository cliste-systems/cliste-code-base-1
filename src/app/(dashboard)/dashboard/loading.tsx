import { Loader2 } from "lucide-react";

/** Shown in the main column while a dashboard route’s RSC tree resolves. */
export default function DashboardLoading() {
  return (
    <div
      className="flex min-h-[min(60vh,32rem)] flex-1 flex-col items-center justify-center gap-3 py-16"
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard"
    >
      <Loader2
        className="size-9 shrink-0 animate-spin text-gray-400"
        aria-hidden
      />
      <p className="text-sm text-gray-500">Loading…</p>
    </div>
  );
}
