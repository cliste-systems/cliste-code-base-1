"use client";

import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ACCOUNT_SIDEBAR_CHILDREN,
  type AccountNavChild,
} from "@/lib/dashboard-account-nav";
import { formatNavBadgeCount } from "@/lib/dashboard-nav-badges";
import {
  dashboardSidebarBadgeClassName,
  dashboardSidebarRowClassName,
} from "@/components/dashboard/dashboard-sidebar-nav-shared";
import { isDashboardNavItemActive } from "@/lib/dashboard-nav-active";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard/usage": Gauge,
  "/dashboard/billing": Gauge,
  "/dashboard/support": LifeBuoy,
  "/dashboard/legal/data-requests": Shield,
  "/dashboard/privacy": Shield,
  "/dashboard/locations": Building2,
  "/dashboard/team": Users,
  "/dashboard/business/profile": Briefcase,
  "/dashboard/settings": Settings,
};

export function AccountSidebarNav({
  items = ACCOUNT_SIDEBAR_CHILDREN,
}: {
  items?: AccountNavChild[];
}) {
  const pathname = usePathname();

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
        const active = isDashboardNavItemActive(pathname, item);
        const showBadge = typeof item.badge === "number" && item.badge > 0;

        return (
          <li key={item.href}>
            <Link
              href={item.href}
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
                <span className="truncate">{item.label}</span>
              </span>
              {showBadge ? (
                <span
                  className={dashboardSidebarBadgeClassName(active)}
                  aria-label={`${formatNavBadgeCount(item.badge)} pending`}
                >
                  {formatNavBadgeCount(item.badge)}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
