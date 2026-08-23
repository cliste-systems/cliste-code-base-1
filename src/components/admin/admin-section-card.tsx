import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AdminSectionCardProps = {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  padded?: boolean;
};

export function AdminSectionCard({
  title,
  description,
  children,
  className,
  contentClassName,
  padded = false,
}: AdminSectionCardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      {title ? (
        <header className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          ) : null}
        </header>
      ) : null}
      <div className={cn(padded && "p-5", contentClassName)}>{children}</div>
    </section>
  );
}
