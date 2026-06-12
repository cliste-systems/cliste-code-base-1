"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getMissingBaseLegalAcceptances,
  recordLegalAcceptances,
  type LegalDocumentType,
} from "@/lib/legal-acceptances";
import { requireOnboardingSession } from "@/lib/onboarding-session";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { createAdminClient } from "@/utils/supabase/admin";

export type AcceptOnboardingLegalResult =
  | { ok: true }
  | { ok: false; message: string };

export async function acceptOnboardingLegalDocuments(
  _: unknown,
  formData: FormData,
): Promise<AcceptOnboardingLegalResult> {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();

  const missing = await getMissingBaseLegalAcceptances(admin, {
    userId: session.user.id,
    organizationId: session.organizationId,
  });

  if (missing.length === 0) {
    redirect("/onboarding");
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
      message: "Please accept the terms of service and privacy notice to continue.",
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
      source: "onboarding_legal",
    },
  });

  redirect("/onboarding");
}
