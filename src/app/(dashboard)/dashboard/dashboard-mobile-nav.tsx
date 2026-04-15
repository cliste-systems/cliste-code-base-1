"use client";

import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  NotebookText,
  Phone,
  Settings,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
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
  "/dashboard/storefront": Store,
  "/dashboard/support": HelpCircle,
  "/dashboard/settings": Settings,
};

type DashboardMobileNavProps = {
  items: DashboardSidebarNavItem[];
};

export function DashboardMobileNav({ items }: DashboardMobileNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Dashboard"
    >
      {items.map((item) => {
        const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const badgeCount =
          typeof item.badge === "number" && item.badge > 0 ? item.badge : null;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors",
              active
                ? "border border-gray-200/60 bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:bg-gray-100/80 hover:text-gray-900",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="max-w-[9rem] truncate">{item.label}</span>
            {badgeCount != null ? (
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white tabular-nums",
                  item.href === "/dashboard/action-inbox"
                    ? "bg-red-600"
                    : "bg-gray-900",
                )}
                aria-label={`${formatNavBadgeCount(badgeCount)} items`}
              >
                {formatNavBadgeCount(badgeCount)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
