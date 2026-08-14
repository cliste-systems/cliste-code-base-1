import Link from "next/link";

import { PRODUCT_NAME } from "@/lib/company-details";
import { AUTH_PAGE_BG } from "@/components/auth/auth-ui";

export default function NotFound() {
  return (
    <main className={AUTH_PAGE_BG}>
      <div className="relative z-10 w-full max-w-md rounded-[24px] bg-white px-6 py-8 text-center shadow-[0_14px_42px_-16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80 sm:px-9 sm:py-10">
        <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
          {PRODUCT_NAME}
        </p>
        <h1 className="mt-3 text-2xl font-light tracking-tight text-slate-900">
          Page not found
        </h1>
        <p className="mt-2 text-sm leading-relaxed font-light text-slate-500">
          The page you requested does not exist or may have moved.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
