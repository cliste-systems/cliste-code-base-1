import { PRODUCT_NAME } from "@/lib/company-details";
import Link from "next/link";

import { Building2 } from "lucide-react";

import { DashboardViewportLock } from "@/app/(dashboard)/dashboard/dashboard-viewport-lock";
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
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                    <Building2
                      className="size-4 text-slate-600"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-col">
                    <span className="block text-sm font-semibold leading-tight text-[#0b1220]">
                      {PRODUCT_NAME}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Admin console
                    </span>
                  </div>
                </Link>
              </div>

              <AdminNav loggedInAs={loggedInAs} />
            </div>
          </aside>

          <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-slate-100/80 has-[data-admin-fill]:overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
