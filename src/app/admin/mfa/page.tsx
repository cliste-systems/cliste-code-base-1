import { redirect } from "next/navigation";

import {
  adminMfaAssuranceLevel,
  requireAdminSessionUser,
} from "@/lib/admin-session";

import { AdminMfaSetup } from "./setup";

export const dynamic = "force-dynamic";

export default async function AdminMfaPage() {
  await requireAdminSessionUser();
  const level = await adminMfaAssuranceLevel();

  if (level === "aal2") {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Cliste Systems
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Admin verification
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Admin accounts require a second factor before the console or company
            inbox can be opened.
          </p>
        </div>

        <AdminMfaSetup />
      </div>
    </main>
  );
}
