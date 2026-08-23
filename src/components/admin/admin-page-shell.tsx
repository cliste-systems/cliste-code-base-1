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

/** Shared horizontal padding for all admin pages. */
export const ADMIN_PAGE_X_PADDING = "px-6";

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
  /** Lock page to viewport height (pairs with AdminListCard). */
  fillViewport?: boolean;
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
  fillViewport = false,
}: AdminPageShellProps) {
  return (
    <div
      {...(fillViewport ? { "data-admin-fill": true } : {})}
      className={cn(
        "mx-auto w-full",
        ADMIN_PAGE_X_PADDING,
        fillViewport
          ? "flex min-h-0 flex-1 flex-col gap-6 overflow-hidden pt-10 pb-6"
          : "space-y-8 py-10",
        MAX_WIDTH_CLASS[maxWidth],
        className,
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {backLabel ?? "Back"}
        </Link>
      ) : null}

      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <Icon className="h-5 w-5 text-gray-500" aria-hidden />
            {title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>

      {fillViewport ? (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      ) : (
        children
      )}
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
