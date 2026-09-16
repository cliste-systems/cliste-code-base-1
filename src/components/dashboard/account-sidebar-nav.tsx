"use client";

import type { LucideIcon } from "lucide-react";
import {
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
  dashboardSidebarGroupClassName,
  dashboardSidebarRowClassName,
} from "@/components/dashboard/dashboard-sidebar-nav-shared";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard/usage": Gauge,
  "/dashboard/billing": Gauge,
  "/dashboard/support": LifeBuoy,
  "/dashboard/legal/data-requests": Shield,
  "/dashboard/privacy": Shield,
  "/dashboard/locations": Building2,
  "/dashboard/team": Users,
  "/dashboard/settings": Settings,
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

  return (
    <div className={dashboardSidebarGroupClassName()}>
      {items.map((item) => (
        <NavRow
          key={item.href}
          href={item.href}
          label={item.label}
          active={isChildActive(pathname, item.href)}
          badge={item.badge}
        />
      ))}
    </div>
  );
}
