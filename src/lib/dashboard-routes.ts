/** Canonical dashboard paths (visible product language). */
export const DASHBOARD_ROUTES = {
  /** Knowledge Gaps — default landing for the store dashboard. */
  home: "/dashboard",
  setup: "/dashboard/setup",
  activity: "/dashboard/activity",
  calls: "/dashboard/calls",
  actionInbox: "/dashboard/action-inbox",
  contacts: "/dashboard/contacts",
  routing: "/dashboard/routing",
  /** @deprecated Use businessProfile or caraGreeting */
  caraSetup: "/dashboard/cara-setup",
  caraGreeting: "/dashboard/cara/greeting",
  caraTraining: "/dashboard/cara-training",
  businessProfile: "/dashboard/business/profile",
  businessServices: "/dashboard/business/services",
  businessFaqs: "/dashboard/business/faqs",
  businessFiles: "/dashboard/business/files",
  usage: "/dashboard/usage",
  support: "/dashboard/support",
  legal: "/dashboard/legal",
  legalAccept: "/dashboard/legal-accept",
  legalDataRequests: "/dashboard/legal/data-requests",
  legalCallerNotice: "/dashboard/legal/caller-notice",
  /** @deprecated Use legalDataRequests */
  gdpr: "/dashboard/legal/data-requests",
  settings: "/dashboard/settings",
  locations: "/dashboard/locations",
  team: "/dashboard/team",
} as const;

/** Paths that share one agent-config form (unsaved guard treats as same surface). */
export const AGENT_CONFIG_PATH_PREFIXES = [
  "/dashboard/cara/",
  "/dashboard/business/",
  "/dashboard/setup",
] as const;

export function isAgentConfigPath(href: string): boolean {
  return AGENT_CONFIG_PATH_PREFIXES.some((prefix) => href.startsWith(prefix));
}

/** All agent-config pages to revalidate after knowledge saves. */
export const AGENT_CONFIG_REVALIDATE_PATHS = [
  DASHBOARD_ROUTES.setup,
  DASHBOARD_ROUTES.caraGreeting,
  DASHBOARD_ROUTES.businessProfile,
  DASHBOARD_ROUTES.businessServices,
  DASHBOARD_ROUTES.businessFaqs,
  DASHBOARD_ROUTES.businessFiles,
  DASHBOARD_ROUTES.caraSetup,
  `${DASHBOARD_ROUTES.caraSetup}/general`,
  `${DASHBOARD_ROUTES.caraSetup}/services`,
  `${DASHBOARD_ROUTES.caraSetup}/answers`,
] as const;

/** Exact legacy paths → canonical (middleware + bookmarks). */
export const LEGACY_DASHBOARD_REDIRECTS: Record<string, string> = {
  "/dashboard/legal/accept": DASHBOARD_ROUTES.legalAccept,
  "/dashboard/call-history": DASHBOARD_ROUTES.calls,
  "/dashboard/cara-training": DASHBOARD_ROUTES.home,
  "/dashboard/privacy": DASHBOARD_ROUTES.legalDataRequests,
  "/dashboard/calendar": DASHBOARD_ROUTES.home,
  "/dashboard/bookings": DASHBOARD_ROUTES.home,
  "/dashboard/payments": DASHBOARD_ROUTES.home,
  "/dashboard/services": DASHBOARD_ROUTES.home,
  "/dashboard/storefront": DASHBOARD_ROUTES.home,
  "/dashboard/reports": DASHBOARD_ROUTES.home,
};

/** Phase 1 strip: prefixes that must not stay reachable in the store UI. */
const STRIPPED_DASHBOARD_PREFIX_REDIRECTS: ReadonlyArray<{
  prefix: string;
  to: string;
}> = [
  { prefix: "/dashboard/action-inbox", to: DASHBOARD_ROUTES.calls },
  { prefix: "/dashboard/contacts", to: DASHBOARD_ROUTES.calls },
  { prefix: "/dashboard/clients", to: DASHBOARD_ROUTES.calls },
  { prefix: "/dashboard/routing", to: DASHBOARD_ROUTES.home },
  { prefix: "/dashboard/usage", to: DASHBOARD_ROUTES.home },
  { prefix: "/dashboard/billing", to: DASHBOARD_ROUTES.home },
  { prefix: "/dashboard/team", to: DASHBOARD_ROUTES.home },
  { prefix: "/dashboard/locations", to: DASHBOARD_ROUTES.home },
  { prefix: "/dashboard/activity", to: DASHBOARD_ROUTES.home },
  { prefix: "/dashboard/cara-setup", to: DASHBOARD_ROUTES.setup },
  { prefix: "/dashboard/agent-setup", to: DASHBOARD_ROUTES.setup },
  { prefix: "/dashboard/cara", to: DASHBOARD_ROUTES.setup },
  { prefix: "/dashboard/business/profile", to: DASHBOARD_ROUTES.setup },
  { prefix: "/dashboard/business/services", to: DASHBOARD_ROUTES.setup },
  { prefix: "/dashboard/business/faqs", to: DASHBOARD_ROUTES.setup },
];

/**
 * Where a dashboard pathname should 308 to, or null if it stays.
 * Exact legacy map first, then stripped prefixes. Files, legal, settings,
 * support, calls, setup, and Knowledge Gaps (`/dashboard`) are left alone.
 */
export function dashboardStripRedirect(pathname: string): string | null {
  const exact = LEGACY_DASHBOARD_REDIRECTS[pathname];
  if (exact) return exact;
  for (const { prefix, to } of STRIPPED_DASHBOARD_PREFIX_REDIRECTS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return to;
    }
  }
  return null;
}
