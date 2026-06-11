import type { Metadata } from "next";
import Link from "next/link";

import { LegalPathProvider } from "@/components/legal/legal-path-context";

import { LegalNav } from "./legal-nav";

export const metadata: Metadata = {
  title: "Legal — Cliste",
  description:
    "Privacy, terms, sub-processors and cookie information for the Cliste AI voice platform.",
};

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-[13px] font-medium text-slate-600 underline-offset-2 hover:text-[#0b1220] hover:underline"
          >
            ← Cliste Systems
          </Link>
          <Link
            href="/authenticate"
            className="inline-flex h-9 items-center rounded-xl bg-[#0b1220] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0b1220]/90"
          >
            Sign in
          </Link>
        </div>

        <LegalNav />

        <LegalPathProvider variant="public">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-8 sm:py-9">
            <div className="space-y-8">{children}</div>
          </div>
        </LegalPathProvider>

        <footer className="border-t border-slate-200 pt-5 text-[13px] text-slate-500">
          <p>
            Cliste Systems, Dublin, Ireland ·{" "}
            <a
              href="mailto:hello@clistesystems.ie"
              className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              hello@clistesystems.ie
            </a>{" "}
            · privacy:{" "}
            <a
              href="mailto:privacy@clistesystems.ie"
              className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              privacy@clistesystems.ie
            </a>
          </p>
          <p className="mt-2">
            Signed in? Manage GDPR requests in your{" "}
            <Link
              href="/dashboard/legal/data-requests"
              className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              dashboard Legal & privacy
            </Link>{" "}
            area.
          </p>
        </footer>
      </div>
    </div>
  );
}
