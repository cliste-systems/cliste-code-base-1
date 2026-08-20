"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, ChevronDown } from "lucide-react";

import {
  businessSidebarChildrenForVertical,
  isBusinessNavPath,
  type BusinessNavChild,
} from "@/lib/dashboard-business-nav";
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

import { useDashboardVertical } from "@/app/(dashboard)/dashboard/dashboard-vertical-context";

function NavSubRow({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={dashboardSidebarSubRowClassName(active)}
      aria-current={active ? "page" : undefined}
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function BusinessSidebarNav({
  children: itemsProp,
}: {
  children?: BusinessNavChild[];
}) {
  const { vertical } = useDashboardVertical();
  const items =
    itemsProp ?? businessSidebarChildrenForVertical(vertical);
  const pathname = usePathname();
  const onBusinessRoute = isBusinessNavPath(pathname);
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const [routeCollapsed, setRouteCollapsed] = useState(false);

  const childActive = items.some(
    (item) =>
      pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const sectionActive = onBusinessRoute && childActive;
  const expanded = onBusinessRoute ? !routeCollapsed : manuallyExpanded;

  return (
    <div className={dashboardSidebarGroupClassName()}>
      <button
        type="button"
        onClick={() => {
          if (onBusinessRoute) {
            setRouteCollapsed((open) => !open);
            return;
          }
          setManuallyExpanded((open) => !open);
        }}
        className={dashboardSidebarHeaderClassName(sectionActive)}
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Briefcase
            className={cn(
              "size-4 shrink-0",
              onBusinessRoute
                ? "text-[#0f172a]"
                : "text-[#64748b] group-hover:text-[#0f172a]",
            )}
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="truncate">Business</span>
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
