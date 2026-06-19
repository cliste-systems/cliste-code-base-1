"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CircleUser } from "lucide-react";

import {
  ACCOUNT_SIDEBAR_CHILDREN,
  isAccountNavPath,
  type AccountNavChild,
} from "@/lib/dashboard-account-nav";
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

function isChildActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/legal/data-requests") {
    return (
      pathname === href ||
      pathname.startsWith("/dashboard/legal/") ||
      pathname === "/dashboard/privacy" ||
      pathname.startsWith("/dashboard/privacy/")
    );
  }
  if (href === "/dashboard/usage") {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname === "/dashboard/billing" ||
      pathname.startsWith("/dashboard/billing/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountSidebarNav({
  items = ACCOUNT_SIDEBAR_CHILDREN,
}: {
  items?: AccountNavChild[];
}) {
  const pathname = usePathname();
  const onAccountRoute = isAccountNavPath(pathname);
  const [expanded, setExpanded] = useState(onAccountRoute);

  useEffect(() => {
    if (onAccountRoute) setExpanded(true);
  }, [onAccountRoute]);

  const childActive = items.some((item) => isChildActive(pathname, item.href));

  return (
    <div className={dashboardSidebarGroupClassName()}>
      <button
        type="button"
        onClick={() => {
          if (onAccountRoute) return;
          setExpanded((open) => !open);
        }}
        className={dashboardSidebarHeaderClassName(onAccountRoute && childActive)}
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <CircleUser
            className={cn(
              "size-4 shrink-0",
              onAccountRoute
                ? "text-[#0f172a]"
                : "text-[#64748b] group-hover:text-[#0f172a]",
            )}
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="truncate">Account</span>
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
        {items.map((item) => (
          <NavSubRow
            key={item.href}
            href={item.href}
            label={item.label}
            active={isChildActive(pathname, item.href)}
            badge={item.badge}
          />
        ))}
      </DashboardSidebarNavExpand>
    </div>
  );
}
