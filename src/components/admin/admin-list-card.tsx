import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { AdminSectionCard } from "./admin-section-card";

/** Shell className for list-style admin pages (Customers pattern). */
export const ADMIN_LIST_PAGE_CLASS =
  "flex min-h-full flex-col space-y-6 pb-16";

type AdminListCardProps = {
  countLabel: ReactNode;
  toolbar?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
  className?: string;
  /** When true, card grows to fill remaining viewport below header/stats. */
  fillRemaining?: boolean;
};

export function AdminListCard({
  countLabel,
  toolbar,
  banner,
  children,
  className,
  fillRemaining = false,
}: AdminListCardProps) {
  return (
    <AdminSectionCard
      className={cn(
        "flex flex-col",
        fillRemaining
          ? "min-h-0 flex-1"
          : "min-h-[calc(100vh-14rem)]",
        className,
      )}
      contentClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      <header className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">{countLabel}</p>
        {toolbar ? (
          <div className="flex flex-wrap items-center gap-3">{toolbar}</div>
        ) : null}
      </header>
      {banner ? (
        <div className="border-b border-gray-100 px-4 py-3">{banner}</div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        {children}
      </div>
    </AdminSectionCard>
  );
}
