import type { ComponentType } from "react";

import {
  DASHBOARD_ICON_CHIP_HEADER,
  DASHBOARD_ICON_GLYPH_LG,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <span className={cn("mb-4", DASHBOARD_ICON_CHIP_HEADER, "mt-0")}>
        <Icon className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
      </span>
      <p className="text-[15px] font-semibold text-[#11181d]">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[#6b7c75]">{description}</p>
    </div>
  );
}
