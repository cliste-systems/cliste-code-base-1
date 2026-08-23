import Link from "next/link";

import { DashboardViewportLock } from "@/app/(dashboard)/dashboard/dashboard-viewport-lock";
import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { requireAdminSessionUser } from "@/lib/admin-session";
import { allowAdminDevWithoutSupabase } from "@/lib/supabase-env";

import { AdminNav } from "./admin-nav";

function adminSessionLabel(): string {
  const custom = process.env.CLISTE_ADMIN_DISPLAY_NAME?.trim();
  if (custom) return custom;
  return "admin";
}

export default async function AdminShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAdminSessionUser();
  const loggedInAs =
    user.email?.trim().toLowerCase() || adminSessionLabel();
  const supabaseOffline = allowAdminDevWithoutSupabase();

  return (
    <>
      <DashboardViewportLock />
      <div className="fixed inset-0 z-10 flex flex-col overflow-hidden bg-[#f4f6f8] antialiased text-[#0b1220]">
        {supabaseOffline ? (
          <div
            className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
            role="status"
          >
            Local dev mode — Supabase is not configured. Admin data and actions
            need{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">.env.local</code>.
            Run{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">
              npm run bootstrap:env
            </code>{" "}
            when ready.
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <aside className="relative z-20 hidden h-full w-[248px] shrink-0 flex-col border-r border-slate-200/80 bg-white md:flex">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-slate-100 px-4 py-5">
                <Link
                  href="/admin"
                  className="flex items-center gap-3 rounded-lg outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-slate-400/40"
                >
                  <ClisteLogoMark size={36} priority className="shrink-0" />
                  <div className="min-w-0 flex-col">
                    <span className="block text-sm font-semibold leading-tight text-[#0b1220]">
                      Cliste Systems
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Admin Console
                    </span>
                  </div>
                </Link>
              </div>

              <AdminNav loggedInAs={loggedInAs} />
            </div>
          </aside>

          <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-slate-100/80 has-[data-admin-fill]:overflow-hidden [&>[data-admin-fill]]:min-h-0 [&>[data-admin-fill]]:flex-1 [&>[data-admin-fill]]:w-full">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
