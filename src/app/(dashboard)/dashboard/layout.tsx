import { cookies } from "next/headers";
import Link from "next/link";

import { DashboardLiveRefresh } from "@/components/dashboard-live-refresh";

import { DashboardNavSeenSync } from "./dashboard-nav-seen-sync";

/** Layout reads httpOnly “seen” cookies; must not be statically cached across navigations. */
export const dynamic = "force-dynamic";
import { CaraAssistant } from "@/components/cara-assistant";
import { DevTierSwitcher } from "@/components/dev-tier-switcher";
import { getEffectiveProductTier } from "@/lib/dev-tier-server";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { productNameForNiche } from "@/lib/organization-niche";
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
import {
  isValidSupportDashboardCookieValue,
  SUPPORT_DASHBOARD_COOKIE,
} from "@/lib/support-dashboard-cookie";
import { createAdminClient } from "@/utils/supabase/admin";

import { DashboardMobileNav } from "./dashboard-mobile-nav";
import {
  DashboardSidebar,
  type DashboardSidebarNavItem,
} from "./dashboard-sidebar";

const navItems: {
  href: string;
  label: string;
  nativeOnly?: boolean;
  footer?: boolean;
}[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/action-inbox", label: "Action Inbox" },
  { href: "/dashboard/call-history", label: "Call History" },
  { href: "/dashboard/calendar", label: "Calendar", nativeOnly: true },
  { href: "/dashboard/bookings", label: "Bookings", nativeOnly: true },
  { href: "/dashboard/clients", label: "Clients", nativeOnly: true },
  { href: "/dashboard/services", label: "Services & team", nativeOnly: true },
  { href: "/dashboard/storefront", label: "Storefront", nativeOnly: true },
  { href: "/dashboard/payments", label: "Payments", nativeOnly: true },
  { href: "/dashboard/support", label: "Support", footer: true },
  { href: "/dashboard/settings", label: "Settings", footer: true },
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

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .maybeSingle();

  const cookieStore = await cookies();
  const supportView = await isValidSupportDashboardCookieValue(
    cookieStore.get(SUPPORT_DASHBOARD_COOKIE)?.value
  );

  let loggedInAs: string;
  if (supportView) {
    loggedInAs = "dev";
  } else if (profileRow?.name?.trim()) {
    loggedInAs = profileRow.name.trim();
  } else if (profileRow?.role === "admin") {
    loggedInAs = "admin";
  } else if (user.email) {
    loggedInAs = user.email.split("@")[0] ?? "Member";
  } else {
    loggedInAs = "Member";
  }

  const userMeta = user.user_metadata as Record<string, unknown> | undefined;
  const needsPassword =
    userMeta?.needs_password === true || userMeta?.needs_password === "true";

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("name, tier, slug, niche")
    .eq("id", organizationId)
    .maybeSingle();

  const effectiveTier = await getEffectiveProductTier(orgRow?.tier);

  let salonName = orgRow?.name?.trim() ?? null;
  let nicheForProduct = orgRow?.niche;

  if (!salonName || nicheForProduct == null) {
    try {
      const admin = createAdminClient();
      const { data: adminOrg } = await admin
        .from("organizations")
        .select("name, niche")
        .eq("id", organizationId)
        .maybeSingle();
      if (!salonName) {
        salonName = adminOrg?.name?.trim() ?? null;
      }
      if (nicheForProduct == null && adminOrg?.niche != null) {
        nicheForProduct = adminOrg.niche;
      }
    } catch {
      /* missing SUPABASE_SERVICE_ROLE_KEY */
    }
  }

  const salonDisplay = salonName?.trim() || null;
  const orgSlug = orgRow?.slug?.trim() || null;
  const productName = productNameForNiche(nicheForProduct);

  const showNativeNav = effectiveTier === "native";
  const visibleNav = showNativeNav
    ? navItems
    : navItems.filter((item) => !item.nativeOnly);

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

  const navBadges = await fetchDashboardNavBadges(
    supabase,
    organizationId,
    showNativeNav,
    navSeenAt,
  );

  const mainNav = visibleNav
    .filter((i) => !i.footer)
    .map((item) => toNavItem(item, navBadges));
  const footerNav = visibleNav
    .filter((i) => i.footer)
    .map((item) => toNavItem(item, navBadges));
  const mobileNavItems: DashboardSidebarNavItem[] = visibleNav.map((item) =>
    toNavItem(item, navBadges),
  );

  return (
    <>
      <div className="relative flex h-dvh w-full max-w-[100vw] flex-col overflow-hidden bg-[#F3F4F6] text-gray-900 lg:flex-row">
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-white/40 to-transparent lg:left-64"
          aria-hidden
        />

        <DashboardSidebar
          organizationName={salonDisplay}
          organizationSlug={orgSlug}
          productName={productName}
          loggedInAs={loggedInAs}
          mainNav={mainNav}
          footerNav={footerNav}
          needsPassword={needsPassword}
        />

        <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#FAFAFA] lg:min-h-dvh">
          <div className="shrink-0 border-b border-gray-200/80 bg-white px-3 py-2 lg:hidden">
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
          <main className="dashboard-main-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[#FAFAFA]">
            <div className="flex min-h-0 w-full flex-1 flex-col px-5 py-8 sm:px-8 lg:px-10 lg:py-10 xl:px-12">
              {children}
            </div>
          </main>
        </div>
      </div>
      <DashboardNavSeenSync />
      <DashboardLiveRefresh organizationId={organizationId} />
      <CaraAssistant />
      {process.env.NODE_ENV === "development" ? (
        <DevTierSwitcher initialTier={effectiveTier} />
      ) : null}
    </>
  );
}
