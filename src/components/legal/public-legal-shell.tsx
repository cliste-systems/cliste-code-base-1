import Link from "next/link";
import type { ReactNode } from "react";

import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { LegalPathProvider } from "@/components/legal/legal-path-context";
import { PublicLegalTabs } from "@/components/legal/public-legal-tabs";

type Props = {
  children: ReactNode;
};

export function PublicLegalShell({ children }: Props) {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <div className="mx-auto flex w-full flex-col px-5 sm:px-8 md:px-12 lg:px-14 xl:px-16">
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 py-4 sm:py-5">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 rounded-lg text-[#0b1220] transition-opacity hover:opacity-80"
          >
            <ClisteLogoMark size={32} priority />
            <span className="truncate text-[14px] font-semibold tracking-tight">
              Cliste Systems
            </span>
          </Link>
          <Link
            href="/authenticate"
            className="inline-flex h-9 shrink-0 items-center rounded-full bg-[#0b1220] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0b1220]/90"
          >
            Sign in
          </Link>
        </header>

        <div className="border-b border-slate-100 py-3 sm:py-4">
          <PublicLegalTabs />
        </div>

        <LegalPathProvider variant="public">
          <main className="py-7 sm:py-9">
            <div className="space-y-8">{children}</div>
          </main>
        </LegalPathProvider>

        <footer className="space-y-2 border-t border-slate-100 py-6 text-center text-[12px] leading-relaxed text-slate-500 sm:py-8">
          <p>
            Cliste Systems, Dublin, Ireland ·{" "}
            <a
              href="mailto:hello@clistesystems.ie"
              className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              hello@clistesystems.ie
            </a>{" "}
            ·{" "}
            <a
              href="mailto:privacy@clistesystems.ie"
              className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              privacy@clistesystems.ie
            </a>
          </p>
          <p>
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
