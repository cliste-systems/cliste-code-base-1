import Link from "next/link";
import type { ReactNode } from "react";

import { PRODUCT_NAME } from "@/lib/company-details";
import { AUTH_PAGE_BG } from "@/components/auth/auth-ui";

type ErrorShellProps = {
  title: string;
  description: string;
  digest?: string;
  homeHref: string;
  homeLabel: string;
  onRetry?: () => void;
  children?: ReactNode;
};

export function ErrorShell({
  title,
  description,
  digest,
  homeHref,
  homeLabel,
  onRetry,
  children,
}: ErrorShellProps) {
  return (
    <main className={AUTH_PAGE_BG}>
      <div className="relative z-10 w-full max-w-md rounded-[24px] bg-white px-6 py-8 text-center shadow-[0_14px_42px_-16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80 sm:px-9 sm:py-10">
        <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
          {PRODUCT_NAME}
        </p>
        <h1 className="mt-3 text-2xl font-light tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed font-light text-slate-500">
          {description}
        </p>
        {digest ? (
          <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
            Reference: {digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Try again
            </button>
          ) : null}
          <Link
            href={homeHref}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {homeLabel}
          </Link>
        </div>
        {children}
      </div>
    </main>
  );
}
