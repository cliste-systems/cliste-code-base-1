"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  Gauge,
  GraduationCap,
  HelpCircle,
  LifeBuoy,
  Menu,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Phone,
  Settings,
  Share2,
  Shield,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useDashboardVertical } from "@/app/(dashboard)/dashboard/dashboard-vertical-context";
import { dashboardFollowUpHubHref } from "@/lib/dashboard-follow-up-hub";
import { cn } from "@/lib/utils";

import {
  isDashboardNavItemActive,
  type DashboardSidebarNavItem,
} from "./dashboard-sidebar";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/calls": Phone,
  "/dashboard/call-history": Phone,
  "/dashboard/action-inbox": Inbox,
  "/dashboard/routing": Share2,
  "/dashboard/cara-training": GraduationCap,
  "/dashboard/departments": LayoutGrid,
  "/dashboard/faqs": HelpCircle,
  "/dashboard/usage": Gauge,
  "/dashboard/billing": Gauge,
  "/dashboard/support": LifeBuoy,
  "/dashboard/legal/data-requests": Shield,
  "/dashboard/privacy": Shield,
  "/dashboard/locations": Building2,
  "/dashboard/team": Users,
  "/dashboard/settings": Settings,
};

type DashboardMobileNavProps = {
  items: DashboardSidebarNavItem[];
  accountNav: DashboardSidebarNavItem[];
};

function MobileNavLink({
  item,
  onNavigate,
}: {
  item: DashboardSidebarNavItem;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
  const active = isDashboardNavItemActive(pathname, item);
  const label = item.href === "/dashboard" ? "Overview" : item.label;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "bg-slate-100 text-slate-950"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function DashboardMobileNav({
  items,
  accountNav,
}: DashboardMobileNavProps) {
  const [open, setOpen] = useState(false);
  const { copy } = useDashboardVertical();
  const notificationHref = useMemo(
    () => dashboardFollowUpHubHref(copy.vertical.id),
    [copy.vertical.id],
  );
  const closeMenu = () => setOpen(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/m8x4p2n7.png"
            alt=""
            width={30}
            height={30}
            className="size-7 object-contain mix-blend-multiply"
            priority
          />
          <span className="leading-none">
            <span className="block text-[13px] font-semibold tracking-[0.12em] text-slate-950">
              HELLO
            </span>
            <span className="mt-1 block text-[9px] font-medium tracking-[0.14em] text-slate-500">
              CARA
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={notificationHref}
            className="relative inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            aria-label="Open follow-ups"
          >
            <Bell className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            aria-expanded={open}
            aria-controls="dashboard-mobile-menu"
            aria-label="Toggle dashboard menu"
          >
            {open ? (
              <X className="size-4" aria-hidden />
            ) : (
              <Menu className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="dashboard-mobile-menu"
          className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
          aria-label="Dashboard"
        >
          {items.map((item) => (
            <MobileNavLink key={item.href} item={item} onNavigate={closeMenu} />
          ))}
          {accountNav.length > 0 ? (
            <>
              <p className="col-span-2 px-1 pt-2 text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
                Account
              </p>
              {accountNav.map((item) => (
                <MobileNavLink
                  key={item.href}
                  item={item}
                  onNavigate={closeMenu}
                />
              ))}
            </>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
