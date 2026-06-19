import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export type AccountNavChild = {
  href: string;
  label: string;
  badge?: number;
};

export const ACCOUNT_SIDEBAR_CHILDREN: Omit<AccountNavChild, "badge">[] = [
  { href: DASHBOARD_ROUTES.usage, label: "Usage" },
  { href: DASHBOARD_ROUTES.support, label: "Support" },
  { href: DASHBOARD_ROUTES.legalDataRequests, label: "Legal" },
  { href: DASHBOARD_ROUTES.locations, label: "Locations" },
  { href: DASHBOARD_ROUTES.team, label: "Team" },
  { href: DASHBOARD_ROUTES.settings, label: "Settings" },
];

const ACCOUNT_NAV_PREFIXES = [
  DASHBOARD_ROUTES.usage,
  "/dashboard/billing",
  DASHBOARD_ROUTES.support,
  DASHBOARD_ROUTES.legal,
  "/dashboard/privacy",
  DASHBOARD_ROUTES.locations,
  DASHBOARD_ROUTES.team,
  DASHBOARD_ROUTES.settings,
] as const;

export function isAccountNavPath(pathname: string): boolean {
  return ACCOUNT_NAV_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function accountNavChildLabel(pathname: string): string | null {
  const match = ACCOUNT_SIDEBAR_CHILDREN.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (match) return match.label;
  if (pathname.startsWith(DASHBOARD_ROUTES.legal)) return "Legal";
  return null;
}
