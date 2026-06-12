"use client";

import Link from "next/link";

import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";

export function SignupSignInLink() {
  return (
    <OnboardingEnter
      tone="profile"
      className="mt-5 text-center text-[13px] text-slate-500"
    >
      Already have an account?{" "}
      <Link
        href="/authenticate"
        className="font-medium text-[#0b1220] underline underline-offset-2"
      >
        Sign in
      </Link>
    </OnboardingEnter>
  );
}
