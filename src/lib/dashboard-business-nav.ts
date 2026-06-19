import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export const BUSINESS_NAV_PREFIX = "/dashboard/business";

export type BusinessNavChild = {
  href: string;
  label: string;
};

export const BUSINESS_SIDEBAR_CHILDREN: BusinessNavChild[] = [
  { href: DASHBOARD_ROUTES.businessProfile, label: "Profile" },
  { href: DASHBOARD_ROUTES.businessServices, label: "Services" },
  { href: DASHBOARD_ROUTES.businessFaqs, label: "FAQs" },
  { href: DASHBOARD_ROUTES.businessFiles, label: "Files" },
];

export function isBusinessNavPath(pathname: string): boolean {
  return pathname.startsWith(BUSINESS_NAV_PREFIX);
}

export function businessNavChildLabel(pathname: string): string | null {
  const match = BUSINESS_SIDEBAR_CHILDREN.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? null;
}
