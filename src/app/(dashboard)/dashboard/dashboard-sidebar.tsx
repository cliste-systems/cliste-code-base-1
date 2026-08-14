"use client";

import type { LucideIcon } from "lucide-react";
import {
  GraduationCap,
  LayoutDashboard,
  Phone,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LocationSwitcher } from "@/components/dashboard/location-switcher";
import { DashboardProfileMenu } from "@/components/dashboard/dashboard-profile-menu";
import { DashboardStoreFooter } from "@/components/dashboard/dashboard-store-footer";
import type { AccountLocationRow } from "@/lib/account-locations";
import { formatNavBadgeCount } from "@/lib/dashboard-nav-badges";
import { dashboardSidebarRowClassName } from "@/components/dashboard/dashboard-sidebar-nav-shared";
import { cn } from "@/lib/utils";

import type { DashboardAccountSummary } from "@/lib/dashboard-account-summary";

import { DashboardSignOutButton } from "./dashboard-sign-out-button";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": GraduationCap,
  "/dashboard/calls": Phone,
  "/dashboard/setup": Settings,
};

export type DashboardSidebarNavItem = {
  href: string;
  label: string;
  badge?: number;
  /** Highlight when pathname starts with this prefix (e.g. all Cara routes). */
  activePrefix?: string;
};

type DashboardSidebarProps = {
  coreNav: DashboardSidebarNavItem[];
  accountNav: DashboardSidebarNavItem[];
  needsPassword: boolean;
  account: DashboardAccountSummary;
  locations: AccountLocationRow[];
  activeOrganizationId: string;
  viewAllLocations: boolean;
  locationLabel: string;
  accountName: string;
};

function sidebarLabel(item: DashboardSidebarNavItem): string {
  return item.label;
}

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
      className={dashboardSidebarRowClassName(active)}
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
            label={sidebarLabel(item)}
            badge={item.badge}
            active={
              item.activePrefix
                ? pathname.startsWith(item.activePrefix)
                : item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`)
            }
          />
        ))}
      </div>
    </section>
  );
}

export function DashboardSidebar({
  coreNav,
  accountNav: _accountNav,
  needsPassword,
  account,
  locations,
  activeOrganizationId,
  viewAllLocations,
  locationLabel,
  accountName,
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
            <p className="text-[15px] font-semibold tracking-[0.12em] text-[#0f172a]">
              HELLO
            </p>
            <p className="mt-1 text-[10px] font-medium tracking-[0.14em] text-[#64748b]">
              CARA
            </p>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-0.5">
          <NavSection label="Workspace" items={coreNav} />
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
          {locations.length >= 2 ? (
            <LocationSwitcher
              locations={locations}
              activeOrganizationId={activeOrganizationId}
              viewAllLocations={viewAllLocations}
              locationLabel={locationLabel}
              accountName={accountName}
            />
          ) : null}
          <DashboardProfileMenu account={account} />
          <DashboardStoreFooter className="px-1" />
          <DashboardSignOutButton />
        </div>
      </div>
    </aside>
  );
}
