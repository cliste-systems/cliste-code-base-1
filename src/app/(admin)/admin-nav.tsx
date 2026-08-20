"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Inbox,
  LayoutGrid,
  LifeBuoy,
  Phone,
  Shield,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { AdminSignOutButton } from "./admin-sign-out-button";

const nav = [
  { href: "/admin", label: "Overview", icon: LayoutGrid, exact: true },
  {
    href: "/admin/onboarding",
    label: "Onboarding queue",
    icon: Inbox,
    exact: false,
  },
  {
    href: "/admin/phone-pool",
    label: "Phone pool",
    icon: Phone,
    exact: false,
  },
  { href: "/admin/users", label: "Identity & access", icon: Users, exact: false },
  { href: "/admin/security", label: "Security", icon: Shield, exact: false },
  {
    href: "/admin/support",
    label: "Support tickets",
    icon: LifeBuoy,
    exact: false,
  },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ loggedInAs }: { loggedInAs: string }) {
  const pathname = usePathname() ?? "";
  const initial = loggedInAs.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4"
        aria-label="Admin"
      >
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40",
                active
                  ? "bg-slate-100 font-medium text-[#0b1220]"
                  : "font-normal text-slate-600 hover:bg-slate-50 hover:text-[#0b1220]",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active
                    ? "text-[#0b1220]"
                    : "text-slate-400 group-hover:text-slate-600",
                )}
                strokeWidth={1.5}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-100 p-4">
        <div className="mb-3 flex items-center gap-2.5 px-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#0b1220]">
              {loggedInAs}
            </p>
            <p className="text-[11px] text-slate-500">Staff session</p>
          </div>
        </div>
        <AdminSignOutButton />
      </div>
    </div>
  );
}
