"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChevronDown } from "lucide-react";

import {
  CARA_SIDEBAR_CHILDREN,
  isCaraNavPath,
  type CaraNavChild,
} from "@/lib/dashboard-cara-nav";
import { formatNavBadgeCount } from "@/lib/dashboard-nav-badges";
import {
  DASHBOARD_SIDEBAR_CHEVRON_CLASS,
  DashboardSidebarNavExpand,
} from "@/components/dashboard/dashboard-sidebar-nav-expand";
import {
  dashboardSidebarGroupClassName,
  dashboardSidebarHeaderClassName,
  dashboardSidebarSubRowClassName,
} from "@/components/dashboard/dashboard-sidebar-nav-shared";
import { cn } from "@/lib/utils";

function NavSubRow({
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
  const showBadge = typeof badge === "number" && badge > 0;

  return (
    <Link
      href={href}
      className={dashboardSidebarSubRowClassName(active)}
      aria-current={active ? "page" : undefined}
    >
      <span className="truncate">{label}</span>
      {showBadge ? (
        <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[#0f172a] px-1.5 text-[10px] font-semibold text-white tabular-nums">
          {formatNavBadgeCount(badge)}
        </span>
      ) : null}
    </Link>
  );
}

export function CaraSidebarNav({
  children: items = CARA_SIDEBAR_CHILDREN,
}: {
  children?: CaraNavChild[];
}) {
  const pathname = usePathname();
  const onCaraRoute = isCaraNavPath(pathname);
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const [routeCollapsed, setRouteCollapsed] = useState(false);

  const childActive = items.some(
    (item) =>
      pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const sectionActive = onCaraRoute && childActive;
  const expanded = onCaraRoute ? !routeCollapsed : manuallyExpanded;

  return (
    <div className={dashboardSidebarGroupClassName()}>
      <button
        type="button"
        onClick={() => {
          if (onCaraRoute) {
            setRouteCollapsed((open) => !open);
            return;
          }
          setManuallyExpanded((open) => !open);
        }}
        className={dashboardSidebarHeaderClassName(sectionActive)}
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Bot
            className={cn(
              "size-4 shrink-0",
              onCaraRoute
                ? "text-[#0f172a]"
                : "text-[#64748b] group-hover:text-[#0f172a]",
            )}
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="truncate">Cara</span>
        </span>
        <ChevronDown
          className={cn(
            DASHBOARD_SIDEBAR_CHEVRON_CLASS,
            expanded ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
      </button>

      <DashboardSidebarNavExpand expanded={expanded}>
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <NavSubRow
              key={item.href}
              href={item.href}
              label={item.label}
              active={active}
            />
          );
        })}
      </DashboardSidebarNavExpand>
    </div>
  );
}
