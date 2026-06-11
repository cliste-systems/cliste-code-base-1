import type { ReactNode } from "react";
import Link from "next/link";

import { DASHBOARD_SECTION_TITLE_CLASS } from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

/**
 * Section without card chrome — title, optional action, hairline divider, content.
 * Use on Home and other scroll pages instead of stacked shadow cards.
 */
export function DashboardEditorialSection({
  title,
  action,
  children,
  className,
  /** First section on a page can skip the top rule. */
  lead = false,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  lead?: boolean;
}) {
  return (
    <section
      className={cn(!lead && "border-t border-slate-200 pt-8", className)}
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>{title}</h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function DashboardSectionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-[13px] font-medium text-slate-600 transition-colors hover:text-[#0b1220]"
    >
      {children}
    </Link>
  );
}
