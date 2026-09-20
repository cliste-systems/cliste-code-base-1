import type { Metadata } from "next";
import { Headphones } from "lucide-react";

import { AdminErrorCard, AdminPageShell } from "@/components/admin/admin-page-shell";
import { loadAdminDemoCallLines } from "@/lib/admin-demo-call";
import { PRODUCT_NAME } from "@/lib/company-details";

import { DemoCallsView } from "./demo-calls-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Demo calls`,
};

export default async function DemoCallsAdminPage() {
  let loadError: string | null = null;
  let lines: Awaited<ReturnType<typeof loadAdminDemoCallLines>> = [];

  try {
    lines = await loadAdminDemoCallLines();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load demo call lines.";
  }

  return (
    <AdminPageShell
      icon={Headphones}
      title="Demo calls"
      description="Simulate inbound calls in your browser — same voice worker, prompts, and tools as a real phone call, without Twilio/PSTN charges."
    >
      {loadError ? (
        <AdminErrorCard title="Could not load demo lines">{loadError}</AdminErrorCard>
      ) : (
        <DemoCallsView lines={lines} />
      )}
    </AdminPageShell>
  );
}
