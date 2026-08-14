import Link from "next/link";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

const FOOTER_LINKS = [
  { href: DASHBOARD_ROUTES.settings, label: "Settings" },
  { href: DASHBOARD_ROUTES.support, label: "Support" },
  { href: DASHBOARD_ROUTES.legalDataRequests, label: "Legal" },
] as const;

export function DashboardStoreFooter({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Account and legal"
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}
    >
      {FOOTER_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-[11px] font-medium text-[#64748b] underline-offset-2 hover:text-[#0f172a] hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
