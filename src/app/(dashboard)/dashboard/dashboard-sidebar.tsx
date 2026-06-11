"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bot,
  ChevronRight,
  Gauge,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Phone,
  Settings,
  Share2,
  Shield,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { formatNavBadgeCount } from "@/lib/dashboard-nav-badges";
import { cn } from "@/lib/utils";

import type { DashboardAccountSummary } from "@/lib/dashboard-account-summary";

import { DashboardSignOutButton } from "./dashboard-sign-out-button";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/calls": Phone,
  "/dashboard/call-history": Phone,
  "/dashboard/action-inbox": Inbox,
  "/dashboard/contacts": Users,
  "/dashboard/clients": Users,
  "/dashboard/routing": Share2,
  "/dashboard/cara-setup": Bot,
  "/dashboard/agent-setup": Bot,
  "/dashboard/usage": Gauge,
  "/dashboard/billing": Gauge,
  "/dashboard/support": LifeBuoy,
  "/dashboard/legal/data-requests": Shield,
  "/dashboard/privacy": Shield,
  "/dashboard/settings": Settings,
};

export type DashboardSidebarNavItem = {
  href: string;
  label: string;
  /** Open action items, upcoming appointments, etc. Hidden when 0 / unset. */
  badge?: number;
};

type DashboardSidebarProps = {
  coreNav: DashboardSidebarNavItem[];
  caraNav: DashboardSidebarNavItem[];
  adminNav: DashboardSidebarNavItem[];
  needsPassword: boolean;
  account: DashboardAccountSummary;
  /** Short word beside the wordmark; falls back to "Connect" when not tailored. */
  productNoun?: string | null;
};

function NavRow({
  href,
  label,
  active,
  badge,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
}) {
  const Icon = NAV_ICONS[href] ?? LayoutDashboard;
  const showBadge = typeof badge === "number" && badge > 0;
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-11 items-center justify-between gap-2 rounded-xl px-3 text-[13px] transition-colors",
        active
          ? "border border-slate-200 bg-white font-semibold text-[#0b1220] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_-14px_rgba(15,23,42,0.25)]"
          : "border border-transparent font-normal text-slate-500 hover:bg-white/70 hover:text-[#0b1220]",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Icon
          className={cn(
            "size-4 shrink-0 transition-colors",
            active
              ? "text-[#0f172a]"
              : "text-[#64748b] group-hover:text-[#0f172a]",
          )}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </span>
      {showBadge ? (
        <span
          className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[#0f172a] px-1.5 text-[10px] font-semibold text-white tabular-nums"
          aria-label={`${formatNavBadgeCount(badge)} pending`}
        >
          {formatNavBadgeCount(badge)}
        </span>
      ) : null}
    </Link>
  );
}

function NavSection({
  label,
  items,
}: {
  label: string;
  items: DashboardSidebarNavItem[];
}) {
  const pathname = usePathname();
  if (items.length === 0) return null;

  return (
    <section className="space-y-1.5">
      <p className="px-3 text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavRow
            key={item.href}
            href={item.href}
            label={item.label}
            badge={item.badge}
            active={
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
            }
          />
        ))}
      </div>
    </section>
  );
}

export function DashboardSidebar({
  coreNav,
  caraNav,
  adminNav,
  needsPassword,
  account,
  productNoun,
}: DashboardSidebarProps) {
  return (
    <aside className="relative z-10 hidden h-dvh w-[260px] shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-[#fafbfc] lg:flex">
      <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 pb-4 pt-7">
        <div className="mb-6 flex min-w-0 shrink-0 items-center gap-3.5 px-0.5">
          <Image
            src="/m8x4p2n7.png"
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 object-contain mix-blend-multiply"
            priority
          />
          <div className="min-w-0 leading-none">
            <p className="text-[15px] font-semibold tracking-[0.18em] text-[#0f172a]">
              CLISTE
            </p>
            <p className="mt-1 text-[10px] font-medium tracking-[0.14em] text-[#64748b]">
              {productNoun ?? "Connect"}
            </p>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-0.5">
          <NavSection label="Workspace" items={coreNav} />
          <div className="mx-0.5 h-px shrink-0 bg-[#e2e8f0]/90" />
          <NavSection label="Cara" items={caraNav} />
          <div className="mx-0.5 h-px shrink-0 bg-[#e2e8f0]/90" />
          <NavSection label="Account" items={adminNav} />
          {needsPassword ? (
            <>
              <Link
                href="/dashboard/set-password"
                className="mx-0.5 mt-0.5 rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-950 transition-colors hover:bg-amber-100/80"
              >
                Set your password
              </Link>
              <div className="mx-0.5 mt-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-950">
                Finish setup: choose a password (required after your invite
                link).
              </div>
            </>
          ) : null}
        </nav>

        <div className="mt-auto shrink-0 space-y-2 border-t border-[#e8ecf0] pt-4">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2.5 rounded-[18px] border border-slate-200/80 bg-white px-3 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] ring-1 ring-white/70 transition-colors hover:border-slate-300 hover:bg-[#fcfcfd]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[10px] font-semibold tracking-tight text-[#64748b]">
              {account.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-[#0f172a]">
                {account.displayName}
              </span>
              <span className="mt-0.5 block truncate text-[11px] leading-snug text-[#64748b]">
                {account.subtitle}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-[#cbd5e1]" aria-hidden />
          </Link>
          <DashboardSignOutButton />
        </div>
      </div>
    </aside>
  );
}
