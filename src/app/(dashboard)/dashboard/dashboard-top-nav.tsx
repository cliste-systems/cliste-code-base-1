"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  ChevronDown,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion, type Transition } from "motion/react";

import { useOnboardingAnimateIn } from "@/components/onboarding/onboarding-enter";
import { ONBOARDING_EASE, ONBOARDING_ITEM_DURATION } from "@/components/onboarding/onboarding-motion";

import {
  DASHBOARD_TOP_NAV_ICON_BUTTON,
  DASHBOARD_TOP_NAV_ITEM,
  DASHBOARD_TOP_NAV_ITEMS,
  DASHBOARD_TOP_NAV_PILL,
  DASHBOARD_TOP_NAV_SURFACE,
} from "@/components/dashboard/dashboard-surface";
import { TopNavLocationSwitcher } from "@/components/dashboard/location-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AccountLocationRow } from "@/lib/account-locations";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import type { DashboardAccountSummary } from "@/lib/dashboard-account-summary";
import { formatNavBadgeCount } from "@/lib/dashboard-nav-badges";
import { cn } from "@/lib/utils";

import type { DashboardSidebarNavItem } from "./dashboard-sidebar";

type DashboardTopNavProps = {
  primaryNav: DashboardSidebarNavItem[];
  caraNav: DashboardSidebarNavItem[];
  moreNav: DashboardSidebarNavItem[];
  account: DashboardAccountSummary;
  notificationCount: number;
  locations: AccountLocationRow[];
  activeOrganizationId: string;
  viewAllLocations: boolean;
  locationLabel: string;
  accountName: string;
};

const NAV_FADE_HIDDEN = { opacity: 0, y: 8 };
const NAV_FADE_VISIBLE = { opacity: 1, y: 0 };

function navEnterTransition(delay: number): Transition {
  return {
    delay,
    duration: ONBOARDING_ITEM_DURATION,
    ease: ONBOARDING_EASE,
  };
}

function TopNavEnter({
  children,
  className,
  delay,
  ready,
}: {
  children: ReactNode;
  className?: string;
  delay: number;
  ready: boolean;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={NAV_FADE_HIDDEN}
      animate={ready ? NAV_FADE_VISIBLE : NAV_FADE_HIDDEN}
      transition={navEnterTransition(delay)}
    >
      {children}
    </motion.div>
  );
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavGroupActive(
  pathname: string,
  items: DashboardSidebarNavItem[],
): boolean {
  return items.some((item) => isNavActive(pathname, item.href));
}

function TopNavItemShell({
  active,
  children,
  className,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        DASHBOARD_TOP_NAV_ITEM,
        active ? "text-[#0b1220]" : "text-slate-500 hover:text-slate-700",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">{children}</span>
      {active ? (
        <span
          className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[#0b1220]"
          aria-hidden
        />
      ) : null}
    </span>
  );
}

function TopNavLink({
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
      className="shrink-0"
      aria-current={active ? "page" : undefined}
    >
      <TopNavItemShell active={active}>{label}</TopNavItemShell>
    </Link>
  );
}

function TopNavMenuTrigger({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <TopNavItemShell active={active}>
      {label}
      <ChevronDown className="size-3 text-slate-400" aria-hidden />
    </TopNavItemShell>
  );
}

function TopNavDropdown({
  label,
  items,
  active,
}: {
  label: string;
  items: DashboardSidebarNavItem[];
  active: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  if (items.length === 0) {
    return <TopNavMenuTrigger label={label} active={active} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "shrink-0 rounded-full border-0 bg-transparent p-0 shadow-none outline-none transition-colors hover:bg-slate-50",
        )}
      >
        <TopNavMenuTrigger label={label} active={active} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-52">
        {items.map((item) => {
          const itemActive = isNavActive(pathname, item.href);
          return (
            <DropdownMenuItem
              key={item.href}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2",
                itemActive && "bg-slate-50",
              )}
              onSelect={() => router.push(item.href)}
            >
              <span>{item.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardTopNav({
  primaryNav,
  caraNav,
  moreNav,
  account,
  notificationCount,
  locations,
  activeOrganizationId,
  viewAllLocations,
  locationLabel,
  accountName,
}: DashboardTopNavProps) {
  const pathname = usePathname();
  const ready = useOnboardingAnimateIn();
  const reduceMotion = useReducedMotion();
  const inboxHref = primaryNav.find((item) =>
    item.href.includes("action-inbox"),
  )?.href;

  const navClassName = cn(
    DASHBOARD_TOP_NAV_SURFACE,
    "grid h-[72px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6",
  );

  const navContent = (
    <>
      <TopNavEnter
        className="flex min-w-0 items-center gap-3 justify-self-start"
        delay={0.34}
        ready={ready}
      >
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center"
          aria-label="Cliste home"
        >
          <Image
            src={PUBLIC_ASSETS.logo}
            alt=""
            width={32}
            height={32}
            className="size-8 object-contain mix-blend-multiply"
            priority
          />
        </Link>
        <TopNavLocationSwitcher
          inline
          locations={locations}
          activeOrganizationId={activeOrganizationId}
          viewAllLocations={viewAllLocations}
          locationLabel={locationLabel}
          accountName={accountName}
        />
      </TopNavEnter>

      <TopNavEnter className="justify-self-center" delay={0.1} ready={ready}>
        <div className={DASHBOARD_TOP_NAV_ITEMS}>
          {primaryNav.map((item) => (
            <TopNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={isNavActive(pathname, item.href)}
            />
          ))}
          <TopNavDropdown
            label="Cara"
            items={caraNav}
            active={isNavGroupActive(pathname, caraNav)}
          />
          <TopNavDropdown
            label="More"
            items={moreNav}
            active={isNavGroupActive(pathname, moreNav)}
          />
        </div>
      </TopNavEnter>

      <TopNavEnter
        className="flex shrink-0 items-center gap-5 justify-self-end"
        delay={0.2}
        ready={ready}
      >
        <button type="button" className={DASHBOARD_TOP_NAV_PILL}>
          <Calendar className="size-3.5 text-slate-500" aria-hidden />
          <span>Today</span>
          <ChevronDown className="size-3.5 text-slate-400" aria-hidden />
        </button>

        <Link
          href={inboxHref ?? "/dashboard/action-inbox"}
          className={cn(
            DASHBOARD_TOP_NAV_ICON_BUTTON,
            "relative hover:text-slate-700",
          )}
          aria-label="Open notifications"
        >
          <Bell className="size-4" aria-hidden />
          {notificationCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0b1220] px-1 text-[9px] font-semibold text-white tabular-nums">
              {formatNavBadgeCount(notificationCount)}
            </span>
          ) : null}
        </Link>

        <Link
          href="/dashboard/settings"
          className={cn(
            DASHBOARD_TOP_NAV_ICON_BUTTON,
            "text-[11px] font-semibold tracking-tight hover:text-slate-700",
          )}
          aria-label="Account settings"
        >
          {account.initials}
        </Link>
      </TopNavEnter>
    </>
  );

  if (reduceMotion) {
    return (
      <nav className={navClassName} aria-label="Dashboard">
        {navContent}
      </nav>
    );
  }

  return (
    <motion.nav
      className={navClassName}
      aria-label="Dashboard"
      initial={{ opacity: 0, y: 6 }}
      animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      transition={{ duration: 0.62, ease: ONBOARDING_EASE }}
    >
      {navContent}
    </motion.nav>
  );
}
