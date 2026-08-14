import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { HideStripeTestingAssistant } from "@/components/billing/hide-stripe-testing-assistant";
import { DashboardGateShell } from "@/components/dashboard/dashboard-gate-shell";
import { DashboardStoreFooter } from "@/components/dashboard/dashboard-store-footer";
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
import {
  dashboardPathnameFromHeaders,
  dashboardShouldUseGateShell,
  enforceDashboardLegalAcceptance,
} from "@/lib/legal-acceptance-gate";
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
import { DashboardChromeBar } from "./dashboard-chrome-bar";
import {
  DashboardSidebar,
  type DashboardSidebarNavItem,
} from "./dashboard-sidebar";
import {
  DASHBOARD_ROUTES,
  dashboardStripRedirect,
} from "@/lib/dashboard-routes";
import { dashboardVersionDisplay } from "@/lib/dashboard-versions";

import { DASHBOARD_INTERACTIVE_CURSOR, DASHBOARD_REBUILD_SHELL } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

import { DashboardViewportLock } from "./dashboard-viewport-lock";

const navItems: {
  href: string;
  label: string;
  section: "core";
}[] = [
  { href: DASHBOARD_ROUTES.home, label: "Knowledge Gaps", section: "core" },
  { href: DASHBOARD_ROUTES.calls, label: "Calls", section: "core" },
  { href: DASHBOARD_ROUTES.setup, label: "Setup", section: "core" },
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
  const pathname = await dashboardPathnameFromHeaders();
  const stripped = pathname ? dashboardStripRedirect(pathname) : null;
  if (stripped) {
    redirect(stripped);
  }

  if (await dashboardShouldUseGateShell(session, pathname)) {
    return <DashboardGateShell>{children}</DashboardGateShell>;
  }

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

  const lifecycleStatus =
    (accountBilling?.status as string | undefined) ??
    (orgRow?.status as string | undefined) ??
    "active";
  if (
    !session.isLocalPreview &&
    (lifecycleStatus === "pending_verification" ||
      lifecycleStatus === "onboarding")
  ) {
    redirect("/onboarding");
  }

  const suspended = lifecycleStatus === "suspended";

  const navBadges: DashboardNavBadgeMap = suspended
    ? {}
    : await fetchDashboardNavBadges(supabase, organizationId, navSeenAt);

  const userMeta = user.user_metadata as Record<string, unknown> | undefined;
  const needsPassword =
    userMeta?.needs_password === true || userMeta?.needs_password === "true";

  const vertical = verticalPackForNiche(orgRow?.niche);
  const coreNav = navItems.map((item) => toNavItem(item, navBadges));
  const accountNav: DashboardSidebarNavItem[] = [];

  const accountSummary = buildDashboardAccountSummary(profile, user, {
    name: accountBilling?.name ?? orgRow?.name ?? null,
    slug: orgRow?.slug ?? null,
  });
  const locationLabel = locationLabelForVertical(vertical.id);
  const accountName =
    resolveOrganizationDisplayName(
      accountBilling?.name ?? orgRow?.name,
      orgRow?.slug,
    ) || "Your store";
  const versionDisplay = dashboardVersionDisplay({
    experienceLabel: vertical.selection.label,
    packVersion: vertical.packVersion,
  });

  return (
    <>
      <DashboardViewportLock />
      <HideStripeTestingAssistant />
      <div
        className={cn(
          "fixed inset-0 z-10 flex w-full max-w-[100vw] flex-col overflow-hidden bg-[#f3f6f4] text-[#11181d] lg:flex-row",
          DASHBOARD_INTERACTIVE_CURSOR,
        )}
      >
        {!DASHBOARD_REBUILD_SHELL ? (
          <DashboardSidebar
            coreNav={coreNav}
            accountNav={accountNav}
            needsPassword={needsPassword}
            account={accountSummary}
            locations={locations}
            activeOrganizationId={organizationId}
            viewAllLocations={viewAllLocations}
            locationLabel={locationLabel}
            accountName={accountName}
          />
        ) : null}

        <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f3f6f4] lg:h-full">
          {!DASHBOARD_REBUILD_SHELL ? (
            <DashboardChromeBar versionDisplay={versionDisplay} />
          ) : null}
          {!DASHBOARD_REBUILD_SHELL ? (
            <div className="shrink-0 border-b border-[#d9e2dd] bg-[#f3f6f4] px-4 py-3 lg:hidden">
              <DashboardMobileNav
                items={coreNav}
                accountNav={accountNav}
              />
            </div>
          ) : null}
          {!DASHBOARD_REBUILD_SHELL && needsPassword ? (
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
          <main className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden overscroll-y-none bg-[#f3f6f4]">
            <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-[1500px] flex-1 flex-col overflow-y-auto bg-[#f3f6f4] px-6 py-6 sm:px-8 has-[data-dashboard-fill]:min-h-0 has-[data-dashboard-fill]:overflow-hidden has-[data-dashboard-home]:!overflow-y-auto has-[data-dashboard-fill]:p-0 [scrollbar-gutter:stable]">
              {DASHBOARD_REBUILD_SHELL ? null : (
                <DashboardVerticalProvider
                  niche={orgRow?.niche}
                  businessType={orgRow?.agent_business_type}
                >
                  {suspended ? (
                    <div className="mx-auto w-full max-w-xl py-16">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6">
                        <h1 className="text-lg font-semibold tracking-tight text-amber-950">
                          This account is suspended
                        </h1>
                        <p className="mt-2 text-sm leading-relaxed text-amber-950/90">
                          Cara has stopped answering calls for this store. Contact
                          Cliste to reactivate the account — billing for pilot
                          stores is handled directly, not through this dashboard.
                        </p>
                      </div>
                    </div>
                  ) : (
                    children
                  )}
                </DashboardVerticalProvider>
              )}
            </div>
          </main>
          {!DASHBOARD_REBUILD_SHELL ? (
            <div className="shrink-0 border-t border-[#d9e2dd] bg-[#fafbfc] px-4 py-3 lg:hidden">
              <DashboardStoreFooter />
            </div>
          ) : null}
        </div>
      </div>
      <DashboardNavSeenSync />
      <DashboardLiveRefresh organizationId={organizationId} />
    </>
  );
}
