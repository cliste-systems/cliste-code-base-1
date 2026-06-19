import { DashboardProfileAvatar } from "@/components/dashboard/dashboard-profile-avatar";
import type { DashboardAccountSummary } from "@/lib/dashboard-account-summary";

type DashboardProfileMenuProps = {
  account: DashboardAccountSummary;
};

/** Sidebar identity card — display only; edit profile on Settings. */
export function DashboardProfileMenu({ account }: DashboardProfileMenuProps) {
  return (
    <div className="flex w-full items-center gap-2.5 rounded-[18px] border border-slate-200/80 bg-white px-3 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] ring-1 ring-white/70">
      <DashboardProfileAvatar
        initials={account.initials}
        avatarUrl={account.avatarUrl}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-[#0f172a]">
          {account.displayName}
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-snug text-[#64748b]">
          {account.subtitle}
        </span>
      </span>
    </div>
  );
}
