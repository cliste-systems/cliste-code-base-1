"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";

export function SetupBillingButton({
  className,
  label = "Set up billing",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div className={className}>
      <Link
        href="/dashboard/usage/checkout"
        className={cn(
          DASHBOARD_PRIMARY_BUTTON_CLASS,
          "inline-flex w-full items-center justify-center",
        )}
      >
        {label}
      </Link>
    </div>
  );
}
