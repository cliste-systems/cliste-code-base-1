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
  const showConfigError = !gateConfigured || error === "config";
  const showPasswordError = gateConfigured && error === "1";

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-[#f5f7fb] p-4 text-slate-600 antialiased sm:p-6 lg:p-8">
      <main className="relative z-10 grid w-full max-w-[1080px] overflow-hidden rounded-[24px] bg-white shadow-[0_14px_42px_-16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80 lg:grid-cols-[1.2fr_440px]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1f2e4d] via-[#25365a] to-[#2f4672] p-12 text-white lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
          <div className="relative z-10 flex flex-col items-start">
            <div className="mb-16 flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm">
              <Image
                src="/cliste-logo.png"
                alt="Cliste"
                width={30}
                height={30}
                className="h-7 w-7 object-contain"
                priority
              />
            </div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-light text-slate-100/90 backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5" />
              Employee Portal
            </div>
            <h2 className="mb-6 text-3xl leading-[1.12] font-light tracking-tight text-white lg:text-4xl">
              Welcome back.
              <br />
              <span className="text-slate-200/90">Sign in to your account.</span>
            </h2>
            <p className="max-w-sm text-sm leading-relaxed font-light text-slate-200/85">
              Enter your details to securely access the Cliste workspace.
            </p>
          </div>
          <div className="relative z-10 mt-auto flex items-center gap-3 pt-16 text-xs font-light text-slate-200/75">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-20" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.45)]" />
            </span>
            System operational
          </div>
        </section>

        <section className="relative flex flex-col justify-center bg-white p-8 sm:p-12">
          <div className="mb-10 flex flex-col lg:hidden">
            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
              <Image
                src="/cliste-logo.png"
                alt="Cliste"
                width={30}
                height={30}
                className="h-7 w-7 object-contain"
                priority
              />
            </div>
            <h1 className="mb-1.5 text-2xl font-light tracking-tight text-slate-900">
              Admin Sign In
            </h1>
            <p className="text-sm font-light text-slate-500">Cliste Systems</p>
          </div>

          <div className="mb-10 hidden lg:block">
            <h1 className="mb-1.5 text-2xl font-light tracking-tight text-slate-900">
              Admin Sign In
            </h1>
            <p className="text-sm font-light text-slate-500">Cliste Systems</p>
          </div>

          {showConfigError ? (
            <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              Admin access is not configured yet. Set{" "}
              <code className="text-xs">CLISTE_ADMIN_SECRET</code> in Vercel
              environment variables and redeploy.
            </p>
          ) : null}

          <form action={unlockAdminGate} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="admin-gate-pw"
                className="block text-xs font-normal text-slate-500"
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
                className="block w-full appearance-none rounded-md border border-slate-200/90 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-[#1f2e4d] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1f2e4d] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {showPasswordError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                Wrong password. Try again.
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-md bg-[#1f2e4d] px-4 py-2.5 text-sm font-light text-white transition-all hover:bg-[#1a2741] focus:outline-none focus:ring-2 focus:ring-[#1f2e4d] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!gateConfigured}
            >
              Continue to admin
            </button>

            <div className="relative mt-6 mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200/80" />
              </div>
              <div className="relative flex justify-center text-xs font-light">
                <span className="bg-white px-2 text-slate-400">Or</span>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500">
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
