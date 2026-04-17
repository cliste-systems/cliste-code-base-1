import Link from "next/link";

import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

/**
 * Shell for the self-serve onboarding wizard. Lives outside the dashboard
 * gate so new signups can reach it without jumping through the salon staff
 * password gate. Each step is a separate route that calls
 * requireOnboardingSession() to enforce auth + status.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-white via-emerald-50/20 to-white">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-gray-900"
          >
            Cliste <span className="text-emerald-600">Systems</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Setting up your salon…</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-10">{children}</div>
    </main>
  );
}
