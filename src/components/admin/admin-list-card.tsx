import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { AdminSectionCard } from "./admin-section-card";

type AdminListCardProps = {
  countLabel: ReactNode;
  toolbar?: ReactNode;
  stats?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Grow to fill remaining viewport below the page header. Default true. */
  fillRemaining?: boolean;
};

export function AdminListCard({
  countLabel,
  toolbar,
  stats,
  banner,
  children,
  className,
  fillRemaining = true,
}: AdminListCardProps) {
  return (
    <AdminSectionCard
      className={cn(
        "flex min-h-0 flex-col",
        fillRemaining && "flex-1",
        className,
      )}
      contentClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      <header className="flex shrink-0 flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">{countLabel}</p>
        {toolbar ? (
          <div className="flex flex-wrap items-center gap-3">{toolbar}</div>
        ) : null}
      </header>
      {stats ? (
        <div className="shrink-0 border-b border-gray-100 px-5 py-4">
          {stats}
        </div>
      ) : null}
      {banner ? (
        <div className="shrink-0 border-b border-gray-100 px-5 py-4">
          {banner}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        {children}
      </div>
    </AdminSectionCard>
  );
}
