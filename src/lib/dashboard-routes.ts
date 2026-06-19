/** Canonical dashboard paths (visible product language). */
export const DASHBOARD_ROUTES = {
  home: "/dashboard",
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
] as const;

export function isAgentConfigPath(href: string): boolean {
  return AGENT_CONFIG_PATH_PREFIXES.some((prefix) => href.startsWith(prefix));
}

/** All agent-config pages to revalidate after knowledge saves. */
export const AGENT_CONFIG_REVALIDATE_PATHS = [
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

/** Legacy paths → canonical (middleware + bookmarks). */
export const LEGACY_DASHBOARD_REDIRECTS: Record<string, string> = {
  "/dashboard/legal/accept": DASHBOARD_ROUTES.legalAccept,
  "/dashboard/call-history": DASHBOARD_ROUTES.calls,
  "/dashboard/clients": DASHBOARD_ROUTES.contacts,
  "/dashboard/billing": DASHBOARD_ROUTES.usage,
  "/dashboard/agent-setup": DASHBOARD_ROUTES.businessProfile,
  "/dashboard/cara-setup": DASHBOARD_ROUTES.businessProfile,
  "/dashboard/cara-setup/general": DASHBOARD_ROUTES.businessProfile,
  "/dashboard/cara-setup/services": DASHBOARD_ROUTES.businessServices,
  "/dashboard/cara-setup/call-handling": DASHBOARD_ROUTES.caraGreeting,
  "/dashboard/cara/call-handling": DASHBOARD_ROUTES.caraGreeting,
  "/dashboard/cara-setup/answers": DASHBOARD_ROUTES.businessFaqs,
  "/dashboard/cara/rules": DASHBOARD_ROUTES.caraGreeting,
  "/dashboard/business/rules": DASHBOARD_ROUTES.businessProfile,
  "/dashboard/privacy": DASHBOARD_ROUTES.legalDataRequests,
  "/dashboard/calendar": DASHBOARD_ROUTES.home,
  "/dashboard/bookings": DASHBOARD_ROUTES.home,
  "/dashboard/payments": DASHBOARD_ROUTES.home,
  "/dashboard/services": DASHBOARD_ROUTES.home,
  "/dashboard/storefront": DASHBOARD_ROUTES.home,
  "/dashboard/reports": DASHBOARD_ROUTES.home,
};
