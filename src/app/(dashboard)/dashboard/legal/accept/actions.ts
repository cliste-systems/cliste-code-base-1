"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getMissingLegalAcceptances,
  orgNeedsDpaAcceptance,
  recordLegalAcceptances,
  type LegalDocumentType,
} from "@/lib/legal-acceptances";
import { requireDashboardSession } from "@/lib/dashboard-session";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { createAdminClient } from "@/utils/supabase/admin";

export type AcceptLegalDocumentsResult =
  | { ok: true }
  | { ok: false; message: string };

export async function acceptLegalDocuments(
  _: unknown,
  formData: FormData,
): Promise<AcceptLegalDocumentsResult> {
  const session = await requireDashboardSession();
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("status, platform_subscription_id, onboarding_step")
    .eq("id", session.organizationId)
    .maybeSingle();

  const needsDpa = orgNeedsDpaAcceptance(org ?? {});
  const missing = await getMissingLegalAcceptances(admin, {
    userId: session.user.id,
    organizationId: session.organizationId,
    needsDpa,
  });

  if (missing.length === 0) {
    redirect("/dashboard");
  }

  const accepted: LegalDocumentType[] = [];
  for (const doc of missing) {
    const field = `accept_${doc}`;
    if (formData.get(field) === "on") {
      accepted.push(doc);
    }
  }

  if (accepted.length !== missing.length) {
    return {
      ok: false,
      message: "Please accept all required documents to continue.",
    };
  }

  const h = await headers();
  const ctx = buildSecurityEventContext(h);

  try {
    await recordLegalAcceptances(admin, {
      userId: session.user.id,
      organizationId: session.organizationId,
      documents: accepted,
      context: ctx,
    });
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Could not save your acceptance. Please try again.",
    };
  }

  await logSecurityEvent(ctx, {
    eventType: "legal_acceptance",
    outcome: "success",
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    metadata: {
      documents: accepted,
      organizationId: session.organizationId,
    },
  });

  redirect("/dashboard");
}
