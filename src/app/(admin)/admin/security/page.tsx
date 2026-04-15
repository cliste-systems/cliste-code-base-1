import type { Metadata } from "next";
import { Shield } from "lucide-react";

import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cliste Admin — Security",
};

type SecurityEventRow = {
  id: number;
  created_at: string;
  event_type: string;
  outcome: "success" | "failure" | "rate_limited" | "config_error" | string;
  actor_email: string | null;
  target_email: string | null;
  login_email: string | null;
  ip_masked: string | null;
  ip_country: string | null;
  attempt_count: number | null;
  metadata: Record<string, unknown> | null;
};

function outcomeLabel(outcome: SecurityEventRow["outcome"]): string {
  switch (outcome) {
    case "success":
      return "Success";
    case "failure":
      return "Failed";
    case "rate_limited":
      return "Rate limited";
    case "config_error":
      return "Config error";
    default:
      return outcome;
  }
}

function outcomeClass(outcome: SecurityEventRow["outcome"]): string {
  switch (outcome) {
    case "success":
      return "border-green-200/60 bg-green-50 text-green-700";
    case "failure":
      return "border-red-200/60 bg-red-50 text-red-700";
    case "rate_limited":
      return "border-amber-200/80 bg-amber-50 text-amber-800";
    default:
      return "border-gray-200/80 bg-gray-50 text-gray-700";
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminSecurityPage() {
  let loadError: string | null = null;
  let rows: SecurityEventRow[] = [];

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("security_auth_events")
      .select(
        "id, created_at, event_type, outcome, actor_email, target_email, login_email, ip_masked, ip_country, attempt_count, metadata"
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    rows = (data ?? []) as SecurityEventRow[];
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load security events.";
  }

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const failures24h = rows.filter(
    (r) =>
      (r.outcome === "failure" || r.outcome === "rate_limited") &&
      new Date(r.created_at).getTime() >= dayAgo
  ).length;
  const success24h = rows.filter(
    (r) =>
      r.outcome === "success" && new Date(r.created_at).getTime() >= dayAgo
  ).length;
  const uniqueIps24h = new Set(
    rows
      .filter((r) => new Date(r.created_at).getTime() >= dayAgo)
      .map((r) => r.ip_masked || "unknown")
  ).size;

  const attemptsByIdentity = new Map<string, number>();
  for (const row of rows) {
    if (row.outcome !== "failure" && row.outcome !== "rate_limited") continue;
    const who = row.login_email || row.actor_email || row.ip_masked || "unknown";
    attemptsByIdentity.set(who, (attemptsByIdentity.get(who) ?? 0) + 1);
  }
  const topAttempts = [...attemptsByIdentity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-[1200px] p-6 pb-24 sm:p-10 lg:p-12">
      <header className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="size-4 shrink-0 text-gray-400" strokeWidth={1.5} aria-hidden />
          <p className="text-xs font-medium tracking-widest text-gray-500 uppercase">
            Security
          </p>
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-gray-900">
          Access activity
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Track successful and failed logins, where attempts come from, and repeated
          attempts over time.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-red-200/80 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-red-700">{loadError}</p>
          <p className="mt-2 text-xs text-red-700/80">
            If this is a missing-table error, run the latest Supabase migration.
          </p>
        </div>
      ) : (
        <>
          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                Failed attempts (24h)
              </p>
              <p className="mt-2 text-3xl font-medium tracking-tight text-gray-900">
                {failures24h}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                Successful auths (24h)
              </p>
              <p className="mt-2 text-3xl font-medium tracking-tight text-gray-900">
                {success24h}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                Unique IPs (24h)
              </p>
              <p className="mt-2 text-3xl font-medium tracking-tight text-gray-900">
                {uniqueIps24h}
              </p>
            </div>
          </section>

          <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-medium text-gray-900">Repeated attempts</h2>
            {topAttempts.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                No failed or rate-limited attempts recorded yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-1">
                {topAttempts.map(([who, count]) => (
                  <li
                    key={who}
                    className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-sm"
                  >
                    <span className="truncate text-gray-700">{who}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-white">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">When</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Event</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Outcome</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Login email</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Actor</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Target</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">IP / Country</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                      No security events recorded yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/40">
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.event_type}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${outcomeClass(row.outcome)}`}
                        >
                          {outcomeLabel(row.outcome)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.login_email ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.actor_email ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.target_email ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.ip_masked ?? "—"}
                        {row.ip_country ? ` (${row.ip_country})` : ""}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.attempt_count ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
