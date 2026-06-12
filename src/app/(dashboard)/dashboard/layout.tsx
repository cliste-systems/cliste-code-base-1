import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardLiveRefresh } from "@/components/dashboard-live-refresh";

import { DashboardVerticalProvider } from "./dashboard-vertical-context";
import { DashboardNavSeenSync } from "./dashboard-nav-seen-sync";

/** Layout reads httpOnly “seen” cookies; must not be statically cached across navigations. */
export const dynamic = "force-dynamic";
import {
  ALL_LOCATIONS_VIEW_COOKIE,
  locationLabelForVertical,
} from "@/lib/account-locations";
import { loadAccountBilling, loadAccountLocations } from "@/lib/account-session";
import { buildDashboardAccountSummary } from "@/lib/dashboard-account-summary";
import { getCachedDashboardOrganizationRow } from "@/lib/dashboard-organization-cache";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import { verticalPackForNiche } from "@/lib/verticals";
import { enforceDashboardLegalAcceptance } from "@/lib/legal-acceptance-gate";
import { requireDashboardSession } from "@/lib/dashboard-session";
import {
  fetchDashboardNavBadges,
  type DashboardNavBadgeMap,
} from "@/lib/dashboard-nav-badges";
import {
  DASHBOARD_ACTION_INBOX_SEEN_COOKIE,
  DASHBOARD_CALL_HISTORY_SEEN_COOKIE,
  DASHBOARD_CARA_TRAINING_SEEN_COOKIE,
  parseSeenAtCookie,
} from "@/lib/dashboard-nav-seen-cookies";
import { DashboardMobileNav } from "./dashboard-mobile-nav";
import {
  DashboardSidebar,
  type DashboardSidebarNavItem,
} from "./dashboard-sidebar";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

import { DASHBOARD_INTERACTIVE_CURSOR } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

import { DashboardViewportLock } from "./dashboard-viewport-lock";

const navItems: {
  href: string;
  label: string;
  section: "core" | "agent" | "account";
}[] = [
  { href: DASHBOARD_ROUTES.home, label: "Home", section: "core" },
  { href: DASHBOARD_ROUTES.calls, label: "Calls", section: "core" },
  { href: DASHBOARD_ROUTES.actionInbox, label: "Action Inbox", section: "core" },
  { href: DASHBOARD_ROUTES.contacts, label: "Contacts", section: "core" },
  { href: DASHBOARD_ROUTES.routing, label: "Call flow", section: "core" },
  { href: DASHBOARD_ROUTES.caraSetup, label: "Cara Setup", section: "agent" },
  {
    href: DASHBOARD_ROUTES.caraTraining,
    label: "Cara Training",
    section: "agent",
  },
  { href: DASHBOARD_ROUTES.usage, label: "Usage", section: "account" },
  { href: DASHBOARD_ROUTES.support, label: "Support", section: "account" },
  { href: DASHBOARD_ROUTES.legalDataRequests, label: "Legal", section: "account" },
  { href: DASHBOARD_ROUTES.locations, label: "Locations", section: "account" },
  { href: DASHBOARD_ROUTES.team, label: "Team", section: "account" },
  { href: DASHBOARD_ROUTES.settings, label: "Settings", section: "account" },
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
  const session = await requireDashboardSession();
  const { supabase, organizationId, profile, user, accountId } = session;

  await enforceDashboardLegalAcceptance(session);

  const [cookieStore, orgRow, locations, accountBilling] = await Promise.all([
    cookies(),
    getCachedDashboardOrganizationRow(),
    loadAccountLocations(accountId),
    loadAccountBilling(accountId),
  ]);
  const viewAllLocations =
    cookieStore.get(ALL_LOCATIONS_VIEW_COOKIE)?.value === "1";
  const navSeenAt = {
    callHistory: parseSeenAtCookie(
      cookieStore.get(DASHBOARD_CALL_HISTORY_SEEN_COOKIE)?.value,
    ),
    actionInbox: parseSeenAtCookie(
      cookieStore.get(DASHBOARD_ACTION_INBOX_SEEN_COOKIE)?.value,
    ),
    caraTraining: parseSeenAtCookie(
      cookieStore.get(DASHBOARD_CARA_TRAINING_SEEN_COOKIE)?.value,
    ),
  };

  // Gate the dashboard on SaaS lifecycle status. Newly-signed-up salons
  // still in the wizard (or suspended ones) should not see live bookings.
  // Legacy rows created before migration 027 default to status='active' so
  // existing dashboards are unaffected.
  const lifecycleStatus =
    (accountBilling?.status as string | undefined) ??
    (orgRow?.status as string | undefined) ??
    "active";
  if (
    lifecycleStatus === "pending_verification" ||
    lifecycleStatus === "onboarding"
  ) {
    redirect("/onboarding");
  }
  if (lifecycleStatus === "suspended") {
    redirect("/dashboard/usage?suspended=1");
  }

  const navBadges: DashboardNavBadgeMap = await fetchDashboardNavBadges(
    supabase,
    organizationId,
    navSeenAt,
  );

  const userMeta = user.user_metadata as Record<string, unknown> | undefined;
  const needsPassword =
    userMeta?.needs_password === true || userMeta?.needs_password === "true";

  const coreNav = navItems
    .filter((i) => i.section === "core")
    .map((item) => toNavItem(item, navBadges));
  const caraNav = navItems
    .filter((i) => i.section === "agent")
    .map((item) => toNavItem(item, navBadges));
  const adminNav = navItems
    .filter((i) => i.section === "account")
    .map((item) => toNavItem(item, navBadges));
  const mobileNavItems: DashboardSidebarNavItem[] = navItems.map((item) =>
    toNavItem(item, navBadges),
  );

  const accountSummary = buildDashboardAccountSummary(profile, user, {
    name: accountBilling?.name ?? orgRow?.name ?? null,
    slug: orgRow?.slug ?? null,
  });
  const vertical = verticalPackForNiche(orgRow?.niche);
  const productNoun = vertical.id === "generic" ? null : vertical.productNoun;
  const locationLabel = locationLabelForVertical(vertical.id);
  const accountName =
    resolveOrganizationDisplayName(
      accountBilling?.name ?? orgRow?.name,
      orgRow?.slug,
    ) || "Your business";

  return (
    <>
      <DashboardViewportLock />
      <div
        className={cn(
          "fixed inset-0 z-10 flex w-full max-w-[100vw] flex-col overflow-hidden bg-white text-slate-900 lg:flex-row",
          DASHBOARD_INTERACTIVE_CURSOR,
        )}
      >
        <DashboardSidebar
          coreNav={coreNav}
          caraNav={caraNav}
          adminNav={adminNav}
          needsPassword={needsPassword}
          account={accountSummary}
          locations={locations}
          activeOrganizationId={organizationId}
          viewAllLocations={viewAllLocations}
          locationLabel={locationLabel}
          accountName={accountName}
          productNoun={productNoun}
        />

        <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white lg:h-full">
          <div className="shrink-0 border-b border-slate-200 bg-[#fcfcfd] px-4 py-3 lg:hidden">
            <DashboardMobileNav items={mobileNavItems} productNoun={productNoun} />
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
          <main className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden overscroll-y-none bg-white">
            <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-[1500px] flex-1 flex-col overflow-y-auto bg-white px-6 py-6 has-[>[data-dashboard-fill]]:overflow-hidden has-[>[data-dashboard-fill]]:p-0 sm:px-8 [scrollbar-gutter:stable] has-[>[data-dashboard-fill]]:[scrollbar-gutter:auto]">
              <DashboardVerticalProvider
                niche={orgRow?.niche}
                businessType={orgRow?.agent_business_type}
              >
                {children}
              </DashboardVerticalProvider>
            </div>
          </main>
        </div>
      </div>
      <DashboardNavSeenSync />
      <DashboardLiveRefresh organizationId={organizationId} />
    </>
  );
}
