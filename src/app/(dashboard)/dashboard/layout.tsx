import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardLiveRefresh } from "@/components/dashboard-live-refresh";

import { DashboardNavSeenSync } from "./dashboard-nav-seen-sync";

/** Layout reads httpOnly “seen” cookies; must not be statically cached across navigations. */
export const dynamic = "force-dynamic";
import { getEffectiveProductTier } from "@/lib/dev-tier-server";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { requireDashboardSession } from "@/lib/dashboard-session";
import {
  fetchDashboardNavBadges,
  type DashboardNavBadgeMap,
} from "@/lib/dashboard-nav-badges";
import {
  DASHBOARD_ACTION_INBOX_SEEN_COOKIE,
  DASHBOARD_BOOKINGS_SEEN_COOKIE,
  DASHBOARD_CALENDAR_SEEN_COOKIE,
  DASHBOARD_CALL_HISTORY_SEEN_COOKIE,
  parseSeenAtCookie,
} from "@/lib/dashboard-nav-seen-cookies";
import { DashboardMobileNav } from "./dashboard-mobile-nav";
import {
  DashboardSidebar,
  type DashboardSidebarNavItem,
} from "./dashboard-sidebar";
import { DashboardViewportLock } from "./dashboard-viewport-lock";

const navItems: {
  href: string;
  label: string;
  nativeOnly?: boolean;
  section: "core" | "cara" | "admin";
}[] = [
  { href: "/dashboard", label: "Home", section: "core" },
  { href: "/dashboard/action-inbox", label: "Action Inbox", section: "core" },
  { href: "/dashboard/call-history", label: "Call History", section: "core" },
  { href: "/dashboard/calendar", label: "Calendar", nativeOnly: true, section: "core" },
  { href: "/dashboard/bookings", label: "Bookings", nativeOnly: true, section: "core" },
  { href: "/dashboard/clients", label: "Clients", nativeOnly: true, section: "core" },
  { href: "/dashboard/services", label: "Services", nativeOnly: true, section: "core" },
  { href: "/dashboard/team", label: "Team", nativeOnly: true, section: "core" },
  { href: "/dashboard/storefront", label: "Storefront", nativeOnly: true, section: "core" },
  { href: "/dashboard/payments", label: "Payments", nativeOnly: true, section: "core" },
  { href: "/dashboard/reports", label: "Reports", nativeOnly: true, section: "core" },
  { href: "/cara", label: "Cara", section: "cara" },
  { href: "/dashboard/billing", label: "Billing & usage", section: "admin" },
  { href: "/dashboard/support", label: "Support", section: "admin" },
  { href: "/dashboard/settings", label: "Settings", section: "admin" },
  { href: "/dashboard/privacy", label: "Privacy tools", section: "admin" },
];

function toNavItem(
  item: (typeof navItems)[number],
  badges: DashboardNavBadgeMap,
): DashboardSidebarNavItem {
  const n = badges[item.href];
  return {
    href: item.href,
    label: item.label,
    ...(typeof n === "number" && n > 0 ? { badge: n } : {}),
  };
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { supabase, organizationId, user } = await requireDashboardSession();

  const [cookieStore, orgRow] = await Promise.all([
    cookies(),
    getCachedDashboardOrganizationRow(),
  ]);
  const navSeenAt = {
    callHistory: parseSeenAtCookie(
      cookieStore.get(DASHBOARD_CALL_HISTORY_SEEN_COOKIE)?.value,
    ),
    actionInbox: parseSeenAtCookie(
      cookieStore.get(DASHBOARD_ACTION_INBOX_SEEN_COOKIE)?.value,
    ),
    calendar: parseSeenAtCookie(
      cookieStore.get(DASHBOARD_CALENDAR_SEEN_COOKIE)?.value,
    ),
    bookings: parseSeenAtCookie(
      cookieStore.get(DASHBOARD_BOOKINGS_SEEN_COOKIE)?.value,
    ),
  };

  // Gate the dashboard on SaaS lifecycle status. Newly-signed-up salons
  // still in the wizard (or suspended ones) should not see live bookings.
  // Legacy rows created before migration 027 default to status='active' so
  // existing dashboards are unaffected.
  const lifecycleStatus =
    (orgRow?.status as string | undefined) ?? "active";
  if (
    lifecycleStatus === "pending_verification" ||
    lifecycleStatus === "onboarding"
  ) {
    redirect("/onboarding");
  }
  if (lifecycleStatus === "suspended") {
    redirect("/dashboard/billing?suspended=1");
  }

  const effectiveTier = await getEffectiveProductTier(orgRow?.tier);
  const showNativeNav = effectiveTier === "native";

  const navBadges = await fetchDashboardNavBadges(
    supabase,
    organizationId,
    showNativeNav,
    navSeenAt,
  );

  const userMeta = user.user_metadata as Record<string, unknown> | undefined;
  const needsPassword =
    userMeta?.needs_password === true || userMeta?.needs_password === "true";

  const visibleNav = showNativeNav
    ? navItems
    : navItems.filter((item) => !item.nativeOnly);

  const coreNav = visibleNav
    .filter((i) => i.section === "core")
    .map((item) => toNavItem(item, navBadges));
  const caraNav = visibleNav
    .filter((i) => i.section === "cara")
    .map((item) => toNavItem(item, navBadges));
  const adminNav = visibleNav
    .filter((i) => i.section === "admin")
    .map((item) => toNavItem(item, navBadges));
  const mobileNavItems: DashboardSidebarNavItem[] = visibleNav.map((item) =>
    toNavItem(item, navBadges),
  );

  return (
    <>
      <DashboardViewportLock />
      <div className="fixed inset-0 z-10 flex w-full max-w-[100vw] flex-col overflow-hidden bg-[#f4f6f8] text-slate-900 lg:flex-row">
        <DashboardSidebar
          coreNav={coreNav}
          caraNav={caraNav}
          adminNav={adminNav}
          needsPassword={needsPassword}
        />

        <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f4f6f8] lg:h-full">
          <div className="shrink-0 border-b border-slate-200 bg-[#fcfcfd] px-4 py-3 lg:hidden">
            <DashboardMobileNav items={mobileNavItems} />
          </div>
          {needsPassword ? (
            <div className="shrink-0 border-b border-amber-200/60 bg-amber-50/90 px-4 py-3 text-xs leading-snug text-amber-950 lg:hidden">
              Finish setup: choose a password for this account.{" "}
              <Link
                href="/dashboard/set-password"
                className="font-semibold underline-offset-2 hover:underline"
              >
                Set password
              </Link>
            </div>
          ) : null}
          <main className="flex h-full min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden overscroll-y-none bg-[#f4f6f8]">
            <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-y-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-5">
              {children}
            </div>
          </main>
        </div>
      </div>
      <DashboardNavSeenSync />
      <DashboardLiveRefresh organizationId={organizationId} />
    </>
  );
}
