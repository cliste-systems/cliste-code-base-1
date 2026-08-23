import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type AdminPageShellMaxWidth = "6xl" | "3xl";

const MAX_WIDTH_CLASS: Record<AdminPageShellMaxWidth, string> = {
  "6xl": "max-w-6xl",
  "3xl": "max-w-3xl",
};

type AdminPageShellProps = {
  icon: IconType;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  maxWidth?: AdminPageShellMaxWidth;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
  className?: string;
};

export function AdminPageShell({
  icon: Icon,
  title,
  description,
  actions,
  maxWidth = "6xl",
  backHref,
  backLabel,
  children,
  className,
}: AdminPageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto space-y-8 px-6 py-10",
        MAX_WIDTH_CLASS[maxWidth],
        className,
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {backLabel ?? "Back"}
        </Link>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <Icon className="h-5 w-5 text-gray-500" aria-hidden />
            {title}
          </h1>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>

      {children}
    </div>
  );
}

export function AdminPageEmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminErrorCard({
  message,
  hint,
}: {
  message: string;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-red-200/80 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-red-700">{message}</p>
      {hint ? <div className="mt-2 text-sm text-red-600/90">{hint}</div> : null}
    </div>
  );
}
