import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export const CARA_NAV_PREFIX = "/dashboard/cara";

export type CaraNavChild = {
  href: string;
  label: string;
};

export const CARA_SIDEBAR_CHILDREN: CaraNavChild[] = [
  { href: DASHBOARD_ROUTES.caraGreeting, label: "Greeting" },
  { href: DASHBOARD_ROUTES.caraTraining, label: "Training" },
];

export function isCaraNavPath(pathname: string): boolean {
  return (
    pathname.startsWith(CARA_NAV_PREFIX) ||
    pathname === DASHBOARD_ROUTES.caraTraining ||
    pathname.startsWith(`${DASHBOARD_ROUTES.caraTraining}/`)
  );
}

export function caraNavChildLabel(pathname: string): string | null {
  const match = CARA_SIDEBAR_CHILDREN.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? null;
}
