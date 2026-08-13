"use client";

import { cn } from "@/lib/utils";

/** Routing sub-pages share one shell — no nested page transition (dashboard template already fades in). */
export default function RoutingTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden")}>
      {children}
    </div>
  );
}
