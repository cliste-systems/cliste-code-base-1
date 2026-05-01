"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Calendar,
  CreditCard,
  Menu,
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
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { formatNavBadgeCount } from "@/lib/dashboard-nav-badges";
import { cn } from "@/lib/utils";

import type { DashboardSidebarNavItem } from "./dashboard-sidebar";

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
  "/cara": Waves,
  "/dashboard/support": HelpCircle,
  "/dashboard/settings": Settings,
  "/dashboard/privacy": ShieldCheck,
};

type DashboardMobileNavProps = {
  items: DashboardSidebarNavItem[];
};

export function DashboardMobileNav({ items }: DashboardMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const actionInbox = items.find((item) => item.href === "/dashboard/action-inbox");
  const actionBadge =
    typeof actionInbox?.badge === "number" && actionInbox.badge > 0
      ? actionInbox.badge
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/cliste-logo.png"
            alt=""
            width={30}
            height={30}
            className="size-7 object-contain mix-blend-multiply"
            priority
          />
          <span className="leading-none">
            <span className="block text-[13px] font-semibold tracking-[0.2em] text-slate-950">
              CLISTE
            </span>
            <span className="mt-1 block text-[9px] font-medium tracking-[0.3em] text-slate-500">
              STUDIO
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/action-inbox"
            className="relative inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            aria-label="Open notifications"
          >
            <Bell className="size-4" aria-hidden />
            {actionBadge != null ? (
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-slate-900" />
            ) : null}
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
          {items.map((item) => {
            const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const badgeCount =
              typeof item.badge === "number" && item.badge > 0
                ? item.badge
                : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                <span className="truncate">{item.label}</span>
                {badgeCount != null ? (
                  <span
                    className="ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 px-1 text-[9px] font-semibold text-white tabular-nums"
                    aria-label={`${formatNavBadgeCount(badgeCount)} items`}
                  >
                    {formatNavBadgeCount(badgeCount)}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
