import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Standard 5-column stats row used inside AdminListCard. */
export function AdminStatsGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-5", className)}
    >
      {children}
    </section>
  );
}
