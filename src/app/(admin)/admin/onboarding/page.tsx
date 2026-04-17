import Link from "next/link";
import { Inbox } from "lucide-react";

import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

type AppRow = {
  id: string;
  organization_id: string;
  submitted_at: string;
  review_status: string;
  fraud_score: number;
  reasons: string[] | null;
};

export default async function OnboardingQueueAdminPage() {
  const admin = createAdminClient();

  const { data: apps } = await admin
    .from("onboarding_applications")
    .select(
      "id, organization_id, submitted_at, review_status, fraud_score, reasons",
    )
    .order("submitted_at", { ascending: false })
    .limit(200);

  const rows = (apps ?? []) as AppRow[];

  const orgIds = [...new Set(rows.map((r) => r.organization_id))];
  const orgIndex = new Map<
    string,
    { name: string | null; status: string; onboarding_step: number }
  >();
  if (orgIds.length > 0) {
    const { data: orgs } = await admin
      .from("organizations")
      .select("id, name, status, onboarding_step")
      .in("id", orgIds);
    for (const o of orgs ?? []) {
      orgIndex.set(o.id as string, {
        name: (o.name as string | null) ?? null,
        status: (o.status as string | null) ?? "unknown",
        onboarding_step:
          typeof o.onboarding_step === "number" ? o.onboarding_step : 0,
      });
    }
  }

  const pending = rows.filter((r) => r.review_status === "pending_review");
  const recent = rows.filter((r) => r.review_status !== "pending_review");

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-10">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
          <Inbox className="h-5 w-5 text-gray-500" /> Onboarding queue
        </h1>
        <p className="text-sm text-gray-500">
          Self-serve signups flagged by the fraud heuristics. Review, then
          approve or reject in the org detail page.
        </p>
      </header>

      <QueueSection
        title={`Pending review (${pending.length})`}
        empty="No applications need review right now."
        rows={pending}
        orgIndex={orgIndex}
      />

      <QueueSection
        title="Recent decisions"
        empty="No recent decisions yet."
        rows={recent}
        orgIndex={orgIndex}
      />
    </div>
  );
}

function QueueSection({
  title,
  empty,
  rows,
  orgIndex,
}: {
  title: string;
  empty: string;
  rows: AppRow[];
  orgIndex: Map<
    string,
    { name: string | null; status: string; onboarding_step: number }
  >;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs uppercase tracking-wide text-gray-500">
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">{empty}</div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-white text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Org</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Review</th>
              <th className="px-4 py-2 text-left">Score</th>
              <th className="px-4 py-2 text-left">Submitted</th>
              <th className="px-4 py-2 text-left">Reasons</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {rows.map((r) => {
              const org = orgIndex.get(r.organization_id);
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2">{org?.name ?? "(unnamed)"}</td>
                  <td className="px-4 py-2 text-gray-600">{org?.status ?? "?"}</td>
                  <td className="px-4 py-2">
                    <ReviewChip status={r.review_status} />
                  </td>
                  <td className="px-4 py-2 font-mono">{r.fraud_score}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {formatTs(r.submitted_at)}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {r.reasons && r.reasons.length > 0
                      ? r.reasons.join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/organizations/${r.organization_id}`}
                      className="text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ReviewChip({ status }: { status: string }) {
  const cls =
    status === "auto_approved"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "pending_review"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : status === "approved"
          ? "bg-blue-50 text-blue-700 ring-blue-200"
          : status === "rejected"
            ? "bg-red-50 text-red-700 ring-red-200"
            : "bg-gray-100 text-gray-700 ring-gray-200";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IE", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
