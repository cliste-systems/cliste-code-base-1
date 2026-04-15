import Link from "next/link";
import Image from "next/image";

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
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#030406] via-[#07090d] to-[#0a0c10] p-12 text-white lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-400/16 via-transparent to-transparent" />
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
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100/95 backdrop-blur-md">
              Cliste Systems
            </div>
            <h2 className="mb-6 text-3xl leading-[1.12] font-light tracking-tight text-white lg:text-4xl">
              The New Standard for
              <br />
              <span className="text-zinc-300/90">AI Voice in Ireland.</span>
            </h2>
            <p className="max-w-sm text-sm leading-relaxed font-light text-zinc-300/85">
              Automate the ringing phone. We build hyper-realistic Irish voice
              agents to handle admin 24/7 so your team can focus on their work.
            </p>
          </div>
          <div className="relative z-10 mt-auto flex items-center gap-3 pt-16 text-xs font-light text-zinc-300/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-20" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]" />
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
              Authenticate
            </h1>
            <p className="text-sm font-light text-slate-500">
              Continue to your Cliste account
            </p>
          </div>

          <div className="mb-10 hidden lg:block">
            <h1 className="mb-1.5 text-2xl font-light tracking-tight text-slate-900">
              Authenticate
            </h1>
            <p className="text-sm font-light text-slate-500">
              Continue to your Cliste account
            </p>
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
                className="block w-full appearance-none rounded-md border border-slate-200/90 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {showPasswordError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                Wrong password. Try again.
              </p>
            ) : null}
            {error === "rate" ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                Too many attempts. Wait a few minutes and try again.
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-md bg-[#090b0f] px-4 py-2.5 text-sm font-light text-white transition-all hover:bg-[#05070b] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
