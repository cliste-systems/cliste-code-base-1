import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

import { SignupForm } from "./signup-form";

export const metadata = {
  title: "Sign up — Cliste Systems",
  description:
    "Create your Cliste account and set up your AI receptionist in under 10 minutes.",
};

export default async function SignupPage() {
  // If a salon owner already has a session, skip signup entirely.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/auth/post-login");
  }

  return (
    <main className="min-h-dvh bg-gradient-to-b from-white via-emerald-50/20 to-white">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-10 lg:flex-row lg:items-stretch lg:gap-16 lg:px-10">
        <section className="flex flex-1 flex-col justify-center gap-8 lg:gap-12">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-gray-900"
          >
            Cliste <span className="text-emerald-600">Systems</span>
          </Link>

          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              An AI receptionist that never misses a call.
            </h1>
            <p className="max-w-prose text-base text-gray-600">
              Your Cliste number answers in an Irish accent, books clients
              into your calendar, takes payment, and texts the confirmation —
              24/7. Set it up in 10 minutes, cancel any time.
            </p>
          </div>

          <ul className="flex flex-col gap-3 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block size-2 shrink-0 rounded-full bg-emerald-500" />
              Works alongside your existing number via call forwarding — no rip-and-replace.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block size-2 shrink-0 rounded-full bg-emerald-500" />
              Stripe-powered payments with clear, tier-based processing fees (from 0.25%).
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block size-2 shrink-0 rounded-full bg-emerald-500" />
              Replaces €2,100+/mo of receptionist cost for a fraction of the price.
            </li>
          </ul>
        </section>

        <section className="flex flex-1 flex-col justify-center">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-gray-900">
                Create your Cliste account
              </h2>
              <p className="text-sm text-gray-600">
                Just your name, email, and a password. We&apos;ll pick your Irish
                number and tune your AI in the next steps.
              </p>
            </div>
            <SignupForm />
          </div>
        </section>
      </div>
    </main>
  );
}
