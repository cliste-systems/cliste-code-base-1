import {
  SetupChecklist,
  SetupProgressBar,
} from "@/components/dashboard/dashboard-setup-checklist";
import { DASHBOARD_HOME_CARD } from "@/components/dashboard/dashboard-surface";
import type { GoLiveChecklistItem } from "@/lib/dashboard-go-live-checklist";
import { cn } from "@/lib/utils";

export function DashboardHomeGoLiveChecklist({
  items,
  checklistSuffix = "can handle real calls confidently.",
  className,
}: {
  items: GoLiveChecklistItem[];
  checklistSuffix?: string;
  className?: string;
}) {
  const completeCount = items.filter((item) => item.complete).length;

  return (
    <section
      className={cn(DASHBOARD_HOME_CARD, "shrink-0", className)}
      aria-label="Go-live checklist"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Before you go live
          </p>
          <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-[#0b1220]">
            Finish setting up Cara
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            {completeCount} of {items.length} ready — complete the rest so Cara
            {` ${checklistSuffix}`}
          </p>
        </div>
      </div>
      <SetupProgressBar complete={completeCount} total={items.length} />
      <div className="mt-3">
        <SetupChecklist
          steps={items.map((item) => ({
            id: item.id,
            label: item.label,
            complete: item.complete,
            href: item.href,
          }))}
        />
      </div>
    </section>
  );
}
