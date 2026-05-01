"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Calendar,
  ChevronRight,
  CreditCard,
  Gauge,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  NotebookText,
  Phone,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  Waves,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { formatNavBadgeCount } from "@/lib/dashboard-nav-badges";
import { cn } from "@/lib/utils";

import { DashboardSignOutButton } from "./dashboard-sign-out-button";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/action-inbox": Inbox,
  "/dashboard/call-history": Phone,
  "/dashboard/calendar": Calendar,
  "/dashboard/bookings": NotebookText,
  "/dashboard/clients": Users,
  "/dashboard/services": ShoppingBag,
  "/dashboard/team": Scissors,
  "/dashboard/storefront": Store,
  "/dashboard/payments": CreditCard,
  "/dashboard/reports": BarChart3,
  "/cara": Waves,
  "/dashboard/billing": Gauge,
  "/dashboard/support": HelpCircle,
  "/dashboard/settings": Settings,
  "/dashboard/privacy": ShieldCheck,
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
        "flex h-9 items-center justify-between gap-2 rounded-[10px] px-3 text-[13px] transition-colors",
        active
          ? "bg-[#e8edf3] font-medium text-[#0f172a]"
          : "group font-normal text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Icon
          className={cn(
            "size-[17px] shrink-0 transition-colors",
            active
              ? "text-[#0f172a]"
              : "text-[#64748b] group-hover:text-[#0f172a]",
          )}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </span>
      {showBadge ? (
        <span
          className={cn(
            "inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold text-white tabular-nums",
            href === "/dashboard/action-inbox"
              ? "bg-[#334155]"
              : "bg-[#0f172a]",
          )}
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
      <p className="px-3 text-[9px] font-semibold tracking-[0.14em] text-[#94a3b8] uppercase">
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
}: DashboardSidebarProps) {
  return (
    <aside className="relative z-10 hidden h-dvh w-[288px] shrink-0 flex-col overflow-hidden border-r border-[#e8ecf0] bg-[#fafbfc] lg:flex">
      <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 pb-4 pt-7">
        <div className="mb-6 flex min-w-0 shrink-0 items-center gap-3.5 px-0.5">
          <Image
            src="/cliste-logo.png"
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
            <p className="mt-1 text-[10px] font-medium tracking-[0.26em] text-[#64748b]">
              STUDIO
            </p>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-hidden pt-0.5">
          <NavSection label="Core Operations" items={coreNav} />
          <div className="mx-0.5 h-px shrink-0 bg-[#e2e8f0]/90" />
          <NavSection label="Cara" items={caraNav} />
          <div className="mx-0.5 h-px shrink-0 bg-[#e2e8f0]/90" />
          <NavSection label="Admin & Account" items={adminNav} />
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
            className="flex items-center gap-2.5 rounded-xl border border-[#e2e8f0] bg-white px-2.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors hover:border-[#cbd5e1] hover:bg-[#fcfcfd]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[10px] font-semibold tracking-tight text-[#64748b]">
              SD
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-[#0f172a]">
                Sarah Doyle
              </span>
              <span className="mt-0.5 block truncate text-[11px] leading-snug text-[#64748b]">
                Admin · Willow &amp; Co Studio
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
