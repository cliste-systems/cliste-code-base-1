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
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-2">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "border border-gray-200 bg-white font-medium text-gray-900 shadow-sm"
                  : "border border-transparent font-normal text-gray-600 hover:bg-gray-100/80 hover:text-gray-900",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-gray-500" : "text-gray-400",
                )}
                strokeWidth={1.5}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-gray-200/60 p-4">
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white shadow-sm">
            {initial}
          </span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-[0.08em]">
            Admin session
          </span>
        </div>
        <AdminSignOutButton />
      </div>
    </div>
  );
}
