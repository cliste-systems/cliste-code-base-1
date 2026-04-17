"use client";

import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CreditCard,
  Gauge,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  NotebookText,
  Phone,
  Scissors,
  Settings,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { formatNavBadgeCount } from "@/lib/dashboard-nav-badges";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
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
  "/dashboard/storefront": Store,
  "/dashboard/payments": CreditCard,
  "/dashboard/billing": Gauge,
  "/dashboard/support": HelpCircle,
  "/dashboard/settings": Settings,
};

export type DashboardSidebarNavItem = {
  href: string;
  label: string;
  /** Open action items, upcoming appointments, etc. Hidden when 0 / unset. */
  badge?: number;
};

type DashboardSidebarProps = {
  organizationName: string | null;
  /** Public booking URL slug; used when name is missing or the generic "Salon" placeholder. */
  organizationSlug: string | null;
  /** Shown after “Cliste” (e.g. Salon, Barber) from org niche. */
  productName: string;
  loggedInAs: string;
  mainNav: DashboardSidebarNavItem[];
  footerNav: DashboardSidebarNavItem[];
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
        "flex items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-sm transition-all",
        active
          ? "border border-gray-200/60 bg-white font-medium text-gray-900 shadow-sm"
          : "group font-normal text-gray-500 hover:bg-gray-100/50 hover:text-gray-900",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Icon
          className={cn(
            "size-[1.125rem] shrink-0 transition-colors",
            active ? "text-gray-900" : "text-gray-400 group-hover:text-gray-900",
          )}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </span>
      {showBadge ? (
        <span
          className={cn(
            "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold text-white tabular-nums",
            href === "/dashboard/action-inbox"
              ? "bg-red-600"
              : "bg-gray-900",
          )}
          aria-label={`${formatNavBadgeCount(badge)} pending`}
        >
          {formatNavBadgeCount(badge)}
        </span>
      ) : null}
    </Link>
  );
}

export function DashboardSidebar({
  organizationName,
  organizationSlug,
  productName,
  loggedInAs,
  mainNav,
  footerNav,
  needsPassword,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const companyName =
    resolveOrganizationDisplayName(organizationName, organizationSlug) ||
    "Company not set";

  return (
    <aside className="relative z-10 hidden h-dvh w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-gray-100 bg-white lg:flex">
      <div>
        <div className="px-8 pt-8 pb-0">
          <div className="mb-6 flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white shadow-sm">
              <Scissors className="size-4" aria-hidden />
            </div>
            <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xl font-medium tracking-tight text-gray-900">
              <span className="line-clamp-2 break-words">Cliste</span>
              <span className="text-base font-medium text-gray-500">
                {productName}
              </span>
            </h1>
          </div>

          <div className="border-b border-gray-100 pb-6">
            <p className="mb-2.5 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
              Logged in as
            </p>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-gray-900">
                {loggedInAs}
              </p>
              <p className="mt-1 truncate text-xs text-gray-500" title={companyName}>
                {companyName}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-4 pt-5">
          {mainNav.map((item) => (
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
          {needsPassword ? (
            <>
              <Link
                href="/dashboard/set-password"
                className="mt-1 rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-100/80"
              >
                Set your password
              </Link>
              <div className="mx-1 mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-950">
                Finish setup: choose a password (required after your invite
                link).
              </div>
            </>
          ) : null}
        </nav>
      </div>

      <div className="flex flex-col gap-1 border-t border-dashed border-gray-100 px-4 pb-6 pt-4">
        {footerNav.map((item) => (
          <NavRow
            key={item.href}
            href={item.href}
            label={item.label}
            badge={item.badge}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          />
        ))}
        <div className="mx-2 my-2 h-px border-t border-dashed border-gray-100 bg-gray-100" />
        <DashboardSignOutButton />
      </div>
    </aside>
  );
}
