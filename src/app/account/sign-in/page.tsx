import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getClientAccountSession } from "@/lib/client-account-session";

import { ClientSignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in — Cliste",
  description:
    "Sign in to Cliste to see your past bookings, rebook favourites, and save salons you love.",
};

type SignInPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function sanitizeNext(raw: string | undefined): string {
  if (!raw) return "/account";
  try {
    const dec = decodeURIComponent(raw);
    if (dec.startsWith("/") && !dec.startsWith("//")) return dec;
  } catch {
    /* noop */
  }
  return "/account";
}

export default async function ClientSignInPage({
  searchParams,
}: SignInPageProps) {
  const [{ next }, session] = await Promise.all([
    searchParams,
    getClientAccountSession(),
  ]);
  const destination = sanitizeNext(next);
  if (session) {
    redirect(destination);
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f9fb] p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] sm:p-10">
        <ClientSignInForm next={destination} />
      </div>
    </div>
  );
}
