import type { Metadata } from "next";
import Link from "next/link";

import { AuthMarketingShell } from "@/components/auth/auth-marketing-shell";
import { PUBLIC_ASSETS } from "@/lib/public-assets";

import { ResendConfirmationButton } from "./resend-confirmation-button";

export const metadata: Metadata = {
  title: "Confirm your email — Cliste Systems",
  description: "Check your inbox to confirm your Cliste account.",
};

type CheckEmailPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function SignupCheckEmailPage({
  searchParams,
}: CheckEmailPageProps) {
  const q = await searchParams;
  const email = q.email?.trim() ?? "";

  return (
    <AuthMarketingShell
      title="Check your email"
      subtitle="We sent a confirmation link so we know this inbox is yours."
      pageBackground={PUBLIC_ASSETS.onboarding.authSignup}
    >
      <div className="space-y-4 text-sm">
        {email ? (
          <p className="text-muted-foreground">
            Open the link we sent to{" "}
            <span className="text-foreground font-medium">{email}</span> to
            continue setting up Cara.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Open the confirmation link in your inbox to continue setting up Cara.
          </p>
        )}
        <p className="text-muted-foreground">
          The link expires after a while. If you do not see the email, check spam
          or request another link below.
        </p>
        {email ? <ResendConfirmationButton email={email} /> : null}
        <p>
          <Link
            href="/authenticate"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthMarketingShell>
  );
}
