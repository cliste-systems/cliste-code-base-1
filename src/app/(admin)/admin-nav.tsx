"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Headphones,
  LayoutGrid,
  LifeBuoy,
  Mail,
  MessageSquareText,
  Phone,
  Users,
} from "lucide-react";

import { isPublicSignupEnabled } from "@/lib/public-signup";
import {
  adminCustomersPath,
  adminDemoCallsPath,
  adminInboxPath,
  adminOverviewPath,
  adminPhonePoolPath,
  adminSupportPath,
  adminTextRehearsalPath,
} from "@/lib/admin-route-paths";
import { adminNavLinkBaseClass } from "@/components/admin/admin-interactive";
import { cn } from "@/lib/utils";

import { AdminSignOutButton } from "./admin-sign-out-button";

const baseNav = [
  { href: adminOverviewPath(), label: "Overview", icon: LayoutGrid, exact: true },
  {
    href: adminCustomersPath(),
    label: "Customers",
    icon: Users,
    exact: false,
  },
  {
    href: adminPhonePoolPath(),
    label: "Phone pool",
    icon: Phone,
    exact: false,
  },
  {
    href: adminDemoCallsPath(),
    label: "Demo calls",
    icon: Headphones,
    exact: true,
  },
  {
    href: adminTextRehearsalPath(),
    label: "Text rehearsal",
    icon: MessageSquareText,
    exact: true,
  },
  {
    href: adminInboxPath(),
    label: "Inbox",
    icon: Mail,
    exact: false,
  },
  {
    href: adminSupportPath(),
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
  const [publicSignup, setPublicSignup] = useState(false);

  useEffect(() => {
    setPublicSignup(isPublicSignupEnabled());
  }, []);

  const nav = baseNav.filter(
    (item) => !("requiresPublicSignup" in item && item.requiresPublicSignup) || publicSignup,
  );
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
                adminNavLinkBaseClass,
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
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
