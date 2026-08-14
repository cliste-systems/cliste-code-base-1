"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  GraduationCap,
  Menu,
  LayoutDashboard,
  Phone,
  Settings,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DashboardStoreFooter } from "@/components/dashboard/dashboard-store-footer";
import { cn } from "@/lib/utils";

import type { DashboardSidebarNavItem } from "./dashboard-sidebar";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": GraduationCap,
  "/dashboard/calls": Phone,
  "/dashboard/setup": Settings,
};

type DashboardMobileNavProps = {
  items: DashboardSidebarNavItem[];
  accountNav: DashboardSidebarNavItem[];
};

export function DashboardMobileNav({
  items,
  accountNav: _accountNav,
}: DashboardMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
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
              </Link>
            );
          })}
          <div className="col-span-2 border-t border-slate-100 pt-2">
            <DashboardStoreFooter />
          </div>
        </nav>
      ) : null}
    </div>
  );
}
