import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export const CARA_NAV_PREFIX = "/dashboard/cara";

export type CaraNavChild = {
  href: string;
  label: string;
};

export const CARA_SIDEBAR_CHILDREN: CaraNavChild[] = [
  { href: DASHBOARD_ROUTES.caraGreeting, label: "Greeting" },
];

export function isCaraNavPath(pathname: string): boolean {
  return (
    pathname === CARA_NAV_PREFIX || pathname.startsWith(`${CARA_NAV_PREFIX}/`)
  );
}

export function caraNavChildLabel(pathname: string): string | null {
  const match = CARA_SIDEBAR_CHILDREN.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? null;
}
