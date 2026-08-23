import Link from "next/link";

import { cn } from "@/lib/utils";

type SegmentedTab = {
  value: string;
  label: string;
  href: string;
};

type AdminSegmentedTabsProps = {
  tabs: SegmentedTab[];
  activeValue: string;
  ariaLabel: string;
};

export function AdminSegmentedTabs({
  tabs,
  activeValue,
  ariaLabel,
}: AdminSegmentedTabsProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map(({ value, label, href }) => {
        const active = activeValue === value;
        return (
          <Link
            key={value}
            href={href}
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
