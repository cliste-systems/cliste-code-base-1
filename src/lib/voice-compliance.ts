/** Voice pipeline compliance helpers — shared between webhook and ops docs. */

export type VoiceDisclosureReport = {
  confirmed: boolean;
  organizationId: string;
  calledNumber?: string;
};

/**
 * Log when the worker did not confirm AI/recording disclosure on a completed call.
 * Does not block storage — used for compliance monitoring and ops alerts.
 */
export function logDisclosureCompliance(report: VoiceDisclosureReport): void {
  if (report.confirmed) return;
  const payload = {
    organization_id: report.organizationId,
    called_number: report.calledNumber ?? null,
  };
  console.warn("[voice/compliance] disclosure_not_confirmed", payload);
  void persistDisclosureComplianceMiss(report);
}

async function persistDisclosureComplianceMiss(
  report: VoiceDisclosureReport,
): Promise<void> {
  try {
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const { recordComplianceEvent } = await import("@/lib/compliance-events");
    const admin = createAdminClient();
    await recordComplianceEvent(admin, {
      organizationId: report.organizationId,
      eventType: "voice_disclosure_not_confirmed",
      metadata: {
        called_number: report.calledNumber ?? null,
      },
    });
  } catch (err) {
    console.error(
      "[voice/compliance] failed to persist disclosure miss",
      err instanceof Error ? err.message : err,
    );
  }
}
