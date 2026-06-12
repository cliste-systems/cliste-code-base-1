/** Canonical dashboard paths (visible product language). */
export const DASHBOARD_ROUTES = {
  home: "/dashboard",
  calls: "/dashboard/calls",
  actionInbox: "/dashboard/action-inbox",
  contacts: "/dashboard/contacts",
  routing: "/dashboard/routing",
  caraSetup: "/dashboard/cara-setup",
  caraTraining: "/dashboard/cara-training",
  usage: "/dashboard/usage",
  support: "/dashboard/support",
  legal: "/dashboard/legal",
  legalAccept: "/dashboard/legal/accept",
  legalDataRequests: "/dashboard/legal/data-requests",
  /** @deprecated Use legalDataRequests */
  gdpr: "/dashboard/legal/data-requests",
  settings: "/dashboard/settings",
  locations: "/dashboard/locations",
  team: "/dashboard/team",
} as const;

/** Legacy paths → canonical (middleware + bookmarks). */
export const LEGACY_DASHBOARD_REDIRECTS: Record<string, string> = {
  "/dashboard/call-history": DASHBOARD_ROUTES.calls,
  "/dashboard/clients": DASHBOARD_ROUTES.contacts,
  "/dashboard/billing": DASHBOARD_ROUTES.usage,
  "/dashboard/agent-setup": DASHBOARD_ROUTES.caraSetup,
  "/dashboard/privacy": DASHBOARD_ROUTES.legalDataRequests,
  "/dashboard/calendar": DASHBOARD_ROUTES.home,
  "/dashboard/bookings": DASHBOARD_ROUTES.home,
  "/dashboard/payments": DASHBOARD_ROUTES.home,
  "/dashboard/services": DASHBOARD_ROUTES.home,
  "/dashboard/storefront": DASHBOARD_ROUTES.home,
  "/dashboard/reports": DASHBOARD_ROUTES.home,
};
