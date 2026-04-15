import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

import { unlockAdminGate } from "./actions";

export const dynamic = "force-dynamic";

type AdminUnlockPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminUnlockPage({
  searchParams,
}: AdminUnlockPageProps) {
  const { error } = await searchParams;
  const gateConfigured = Boolean(process.env.CLISTE_ADMIN_SECRET?.trim());

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-[#FAFAFA] p-4 text-zinc-600 antialiased sm:p-6 lg:p-8">
      <main className="relative z-10 grid w-full max-w-[1040px] overflow-hidden rounded-[24px] bg-white shadow-[0_12px_40px_-16px_rgba(0,0,0,0.08)] ring-1 ring-zinc-200/50 lg:grid-cols-[1.2fr_420px]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-white lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-800/20 via-zinc-950 to-zinc-950" />
          <div className="relative z-10 flex flex-col items-start">
            <div className="mb-16 flex h-9 w-9 items-center justify-center rounded-md bg-white shadow-sm">
              <Image
                src="/cliste-logo.png"
                alt="Cliste"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
                priority
              />
            </div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5 text-xs font-light text-zinc-300 backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5" />
              Employee Portal
            </div>
            <h2 className="mb-6 text-3xl leading-[1.15] font-light tracking-tight text-zinc-100 lg:text-4xl">
              Welcome back.
              <br />
              <span className="text-zinc-500">Sign in to your account.</span>
            </h2>
            <p className="max-w-sm text-sm leading-relaxed font-light text-zinc-400/80">
              Enter your details to securely access the Cliste workspace.
            </p>
          </div>
          <div className="relative z-10 mt-auto flex items-center gap-3 pt-16 text-xs font-light text-zinc-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-400 opacity-20" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-500 shadow-[0_0_8px_rgba(161,161,170,0.4)]" />
            </span>
            System operational
          </div>
        </section>

        <section className="relative flex flex-col justify-center bg-white p-8 sm:p-12">
          <div className="mb-10 flex flex-col lg:hidden">
            <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-md bg-zinc-950 shadow-sm">
              <Image
                src="/cliste-logo.png"
                alt="Cliste"
                width={24}
                height={24}
                className="h-6 w-6 object-contain invert"
                priority
              />
            </div>
            <h1 className="mb-1.5 text-2xl font-light tracking-tight text-zinc-900">
              Admin Sign In
            </h1>
            <p className="text-sm font-light text-zinc-500">Cliste Systems</p>
          </div>

          <div className="mb-10 hidden lg:block">
            <h1 className="mb-1.5 text-2xl font-light tracking-tight text-zinc-900">
              Admin Sign In
            </h1>
            <p className="text-sm font-light text-zinc-500">Cliste Systems</p>
          </div>

          {!gateConfigured ? (
            <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              <code className="text-xs">CLISTE_ADMIN_SECRET</code> is not set on
              the server. Add it to your deploy env, then redeploy.
            </p>
          ) : null}

          <form action={unlockAdminGate} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="admin-gate-pw"
                className="block text-xs font-normal text-zinc-500"
              >
                Password
              </label>
              <input
                id="admin-gate-pw"
                name="password"
                type="password"
                required
                autoComplete="off"
                placeholder="••••••••"
                disabled={!gateConfigured}
                className="block w-full appearance-none rounded-md border border-zinc-200/80 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {error === "config" ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                Server configuration error. Ensure{" "}
                <code className="text-xs">CLISTE_ADMIN_SECRET</code> is set and
                redeploy.
              </p>
            ) : null}
            {error === "1" ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                Wrong password. Try again.
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-light text-white transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!gateConfigured}
            >
              Continue to admin
            </button>

            <div className="relative mt-6 mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200/80" />
              </div>
              <div className="relative flex justify-center text-xs font-light">
                <span className="bg-white px-2 text-zinc-400">Or</span>
              </div>
            </div>

            <div className="text-center text-xs text-zinc-500">
              <Link href="/authenticate" className="underline-offset-4 hover:underline">
                Sign-in page
              </Link>
              {" · "}
              <Link href="/" className="underline-offset-4 hover:underline">
                Home
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
