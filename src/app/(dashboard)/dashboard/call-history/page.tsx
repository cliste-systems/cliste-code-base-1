import { History, Info } from "lucide-react";

import { requireDashboardSession } from "@/lib/dashboard-session";
import { mapCallLogToRow } from "@/lib/call-history-types";

import { CallHistoryTable } from "./call-history-table";

type CallHistoryPageProps = {
  searchParams?: Promise<{ call?: string }>;
};

export default async function CallHistoryPage({
  searchParams,
}: CallHistoryPageProps) {
  const sp = searchParams ? await searchParams : {};
  const initialOpenCallId =
    typeof sp.call === "string" && sp.call.trim() ? sp.call.trim() : null;

  const { supabase, organizationId } = await requireDashboardSession();
  const { data, error } = await supabase
    .from("call_logs")
    .select(
      "id, caller_number, duration_seconds, outcome, transcript, transcript_review, ai_summary, created_at"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  const calls =
    !error && data
      ? data.map((row) =>
          mapCallLogToRow(
            row as {
              id: string;
              caller_number: string;
              duration_seconds: number;
              outcome: string;
              transcript: string | null;
              transcript_review: string | null;
              ai_summary: string | null;
              created_at: string;
            }
          )
        )
      : [];

  return (
    <div className="-mx-6 -mt-8 flex min-h-0 flex-1 flex-col bg-[#FAFAFA] px-6 pb-12 pt-8 lg:-mx-12 lg:px-12 lg:pt-10">
      <div className="mx-auto w-full max-w-[1100px]">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-gray-500 uppercase">
            <History className="size-3.5 shrink-0" aria-hidden />
            Audit Trail
          </div>
          <h1 className="mb-4 text-3xl font-semibold tracking-tight text-gray-900">
            Call history
          </h1>
          <div className="flex flex-col gap-1">
            <p className="max-w-2xl text-sm leading-relaxed text-gray-500">
              Every conversation your AI handled — tap a row or the transcript
              icon to read the full conversation.
            </p>
            <p className="max-w-2xl text-sm leading-relaxed text-gray-500">
              Outcomes show how each call ended.
            </p>
          </div>
        </header>

        <div className="mb-8 flex items-start gap-3 rounded-xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] sm:items-center">
          <Info
            className="mt-0.5 size-4 shrink-0 text-gray-400 sm:mt-0"
            aria-hidden
          />
          <p className="text-sm text-gray-500">
            Duration is talk time, not hold time.{" "}
            <span className="text-gray-400">
              &ldquo;Message taken&rdquo; and similar outcomes sync to your
              Action Inbox.
            </span>
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <p className="text-sm font-semibold text-red-700">
              Could not load call history
            </p>
            <p className="mt-2 text-sm text-gray-600">{error.message}</p>
          </div>
        ) : (
          <CallHistoryTable
            calls={calls}
            initialOpenCallId={initialOpenCallId}
          />
        )}
      </div>
    </div>
  );
}
