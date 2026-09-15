import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";

import { AdminErrorCard, AdminPageShell } from "@/components/admin/admin-page-shell";
import { PRODUCT_NAME } from "@/lib/company-details";
import { loadPostCallHealthRows } from "@/lib/post-call-health";
import { createAdminClient } from "@/utils/supabase/admin";

import { PostCallHealthView } from "./post-call-health-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Post-call health`,
};

type PostCallHealthPageProps = {
  searchParams?: Promise<{ call?: string }>;
};

export default async function PostCallHealthPage({
  searchParams,
}: PostCallHealthPageProps) {
  const sp = searchParams ? await searchParams : {};
  const selectedCallId =
    typeof sp.call === "string" && sp.call.trim() ? sp.call.trim() : null;

  let loadError: string | null = null;
  let rows: Awaited<ReturnType<typeof loadPostCallHealthRows>> = [];
  let selectedTranscript: string | null = null;

  try {
    rows = await loadPostCallHealthRows(50);

    if (selectedCallId) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("call_logs")
        .select("transcript")
        .eq("id", selectedCallId)
        .maybeSingle();
      selectedTranscript = (data?.transcript as string | null) ?? null;
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load post-call health.";
  }

  return (
    <AdminPageShell
      icon={AlertTriangle}
      title="Post-call health"
      description="Calls where close-pipeline processing failed or only partially completed — review transcript and reprocess to repair shop tickets."
      fillViewport
    >
      {loadError ? <AdminErrorCard message={loadError} /> : null}
      <PostCallHealthView
        rows={rows}
        selectedCallId={selectedCallId}
        selectedTranscript={selectedTranscript}
      />
    </AdminPageShell>
  );
}
