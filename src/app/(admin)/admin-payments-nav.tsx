"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CreditCard } from "lucide-react";

import { DashboardSidebarNavExpand } from "@/components/dashboard/dashboard-sidebar-nav-expand";
import {
  adminNavLinkBaseClass,
} from "@/components/admin/admin-interactive";
import {
  adminPaymentsPlatformSpendPath,
  isAdminPaymentsPath,
} from "@/lib/admin-route-paths";
import { cn } from "@/lib/utils";

const PAYMENTS_CHILDREN = [
  {
    href: adminPaymentsPlatformSpendPath(),
    label: "Platform spend",
  },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminPaymentsNavGroup() {
  const pathname = usePathname() ?? "";
  const onPaymentsRoute = isAdminPaymentsPath(pathname);
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const [routeCollapsed, setRouteCollapsed] = useState(false);

  const childActive = PAYMENTS_CHILDREN.some((item) =>
    isActive(pathname, item.href, true),
  );
  const sectionActive = onPaymentsRoute && childActive;
  const expanded = onPaymentsRoute ? !routeCollapsed : manuallyExpanded;

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => {
          if (onPaymentsRoute) {
            setRouteCollapsed((open) => !open);
            return;
          }
          setManuallyExpanded((open) => !open);
        }}
        className={cn(
          adminNavLinkBaseClass,
          "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
          sectionActive
            ? "bg-slate-100 font-medium text-[#0b1220]"
            : "font-normal text-slate-600 hover:bg-slate-50 hover:text-[#0b1220]",
        )}
        aria-expanded={expanded}
      >
        <CreditCard
          className={cn(
            "size-4 shrink-0 transition-colors",
            sectionActive
              ? "text-[#0b1220]"
              : "text-slate-400 group-hover:text-slate-600",
          )}
          strokeWidth={1.5}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-left">Payments</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform duration-200 ease-out",
            expanded ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
      </button>

      <DashboardSidebarNavExpand expanded={expanded}>
        {PAYMENTS_CHILDREN.map((item) => {
          const active = isActive(pathname, item.href, true);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                adminNavLinkBaseClass,
                "ml-6 flex items-center rounded-lg px-2.5 py-2 text-[13px]",
                active
                  ? "bg-slate-100 font-medium text-[#0b1220]"
                  : "font-normal text-slate-600 hover:bg-slate-50 hover:text-[#0b1220]",
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </DashboardSidebarNavExpand>
    </div>
  );
}
