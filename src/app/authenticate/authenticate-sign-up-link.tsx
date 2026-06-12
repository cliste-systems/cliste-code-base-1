"use client";

import Link from "next/link";

import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";

export function AuthenticateSignUpLink() {
  return (
    <OnboardingEnter
      tone="profile"
      className="mt-5 text-center text-[13px] text-slate-500"
    >
      Don&apos;t have an account?{" "}
      <Link
        href="/signup"
        className="font-medium text-[#0b1220] underline underline-offset-2"
      >
        Create account
      </Link>
    </OnboardingEnter>
  );
}
