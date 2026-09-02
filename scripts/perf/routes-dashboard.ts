import { DASHBOARD_ROUTES } from "../../src/lib/dashboard-routes";

/** Canonical dashboard routes for perf audits (no legacy redirects). */
export const DASHBOARD_PERF_ROUTES: { path: string; label: string }[] = [
  { path: DASHBOARD_ROUTES.home, label: "Home" },
  { path: DASHBOARD_ROUTES.activity, label: "Activity" },
  { path: DASHBOARD_ROUTES.calls, label: "Calls" },
  { path: DASHBOARD_ROUTES.actionInbox, label: "Action Inbox" },
  { path: DASHBOARD_ROUTES.contacts, label: "Contacts" },
  { path: DASHBOARD_ROUTES.caraTraining, label: "Cara Training" },
  { path: `${DASHBOARD_ROUTES.routing}/routes`, label: "Call flow" },
  { path: DASHBOARD_ROUTES.caraGreeting, label: "Cara greeting" },
  { path: DASHBOARD_ROUTES.businessProfile, label: "Business profile" },
  { path: DASHBOARD_ROUTES.businessServices, label: "Business services" },
  { path: DASHBOARD_ROUTES.businessFaqs, label: "Business FAQs" },
  { path: DASHBOARD_ROUTES.businessFiles, label: "Business files" },
  { path: DASHBOARD_ROUTES.usage, label: "Usage" },
  { path: DASHBOARD_ROUTES.settings, label: "Settings" },
  { path: DASHBOARD_ROUTES.team, label: "Team" },
  { path: DASHBOARD_ROUTES.locations, label: "Locations" },
  { path: DASHBOARD_ROUTES.support, label: "Support" },
  { path: DASHBOARD_ROUTES.legalDataRequests, label: "Legal data requests" },
];
