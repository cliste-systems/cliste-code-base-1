"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createPlatformSubscriptionCheckout,
  persistOrgBillingSelection,
  persistPlatformCheckoutSession,
  resolveCheckoutReturnOrigin,
} from "@/lib/platform-billing-checkout";
import {
  isPlanTier,
  PLANS,
  planSupportsSelfServeCheckout,
  type PlanTier,
} from "@/lib/cliste-plans";

/** Stripe plan checkout — off until billing is ready. Set `CLISTE_PLAN_CHECKOUT_ENABLED=true` to enable. */
const PLAN_CHECKOUT_ENABLED =
  process.env.CLISTE_PLAN_CHECKOUT_ENABLED === "true";
import { cleanAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { classifyBusinessDescription } from "@/lib/classify-business-description";
import { nicheHasPhysicalLocation } from "@/lib/organization-niche";
import {
  parseVerticalId,
  resolveNicheForVerticalChoice,
} from "@/lib/verticals";
import { importBusinessFromWebsite } from "@/lib/website-import";
import { geocodeIrelandLocation } from "@/lib/geocode-ireland";
import { CLISTE_DEFAULT_ELEVENLABS_VOICE_ID } from "@/lib/onboarding-voice-presets";
import {
  ONBOARDING_STEPS,
  requireOnboardingSession,
  resolveCurrentStepPath,
} from "@/lib/onboarding-session";
import {
  enforceOnboardingStepOrder,
  isOnboardingFreeNavEnabled,
} from "@/lib/onboarding-dev";
import {
  buildFullVoiceGreeting,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "@/lib/voice-greeting";
import { joinOwnerName, ownerNameNeedsCapture } from "@/lib/profile-display-name";
import { reviewVoiceGreetingSafe } from "@/lib/voice-greeting-review";
import { prepareOnboardingVoiceGreetingInput } from "@/lib/onboarding-voice-input";
import { provisionOrganizationPhoneNumber } from "@/lib/phone-pool";
import {
  getMissingLegalAcceptances,
  recordLegalAcceptances,
} from "@/lib/legal-acceptances";
import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";
import { createAdminClient } from "@/utils/supabase/admin";

async function provisionPhoneForOrganization(organizationId: string): Promise<void> {
  try {
    const result = await provisionOrganizationPhoneNumber(organizationId);
    if (!result.ok) {
      console.warn(
        "[onboarding] phone provision failed",
        organizationId,
        result.message,
      );
    }
  } catch (err) {
    console.error("[onboarding] phone provision error", organizationId, err);
  }
}

/** Flip an organisation live once payment + setup are done (go-live). */
async function activateOrganization(organizationId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({
      status: "active",
      is_active: true,
      onboarding_step: ONBOARDING_STEPS.done,
      launch_status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  revalidatePath("/onboarding", "layout");
  revalidatePath("/dashboard", "layout");
}

/** Cheap guard against keyboard-mashing / obvious non-answers. */
function looksLikeGibberish(text: string): boolean {
  const trimmed = text.trim();
  const letters = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.length < 5) return false;
  const vowels = (letters.match(/[aeiou]/g) ?? []).length;
  if (vowels / letters.length < 0.12) return true;
  if (!/\s/.test(trimmed) && /(.)\1{3,}/.test(trimmed)) return true;
  return false;
}

export type ImportWebsiteResult =
  | {
      ok: true;
      businessDescription: string;
      address: string;
      eircode: string;
      regulated: boolean;
      imported: { services: number; faqs: number; hours: boolean; area: boolean };
    }
  | { ok: false; message: string };

/**
 * Website import — fetch the business site, AI-extract details, persist drafts
 * (so Train Cara prefills), and return the profile fields to prefill on screen.
 */
export async function importWebsiteForProfile(
  url: string,
): Promise<ImportWebsiteResult> {
  const session = await requireOnboardingSession();

  const result = await importBusinessFromWebsite(url);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  const d = result.data;

  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    raw_business_description: d.businessDescription,
    updated_at: new Date().toISOString(),
  };
  if (d.services.length) {
    update.agent_services_departments = d.services.join(", ");
  }
  if (d.servicesNotOffered.length) {
    update.agent_services_not_offered = d.servicesNotOffered.join(", ");
  }
  if (d.openingHours) update.agent_opening_hours = d.openingHours;
  if (d.serviceArea) update.agent_service_area = d.serviceArea;
  if (d.faqs.length) update.agent_faqs = cleanAgentFaqs(d.faqs);

  await admin
    .from("organizations")
    .update(update)
    .eq("id", session.organizationId);

  return {
    ok: true,
    businessDescription: d.businessDescription,
    address: d.address,
    eircode: d.eircode,
    regulated: d.regulated,
    imported: {
      services: d.services.length,
      faqs: d.faqs.length,
      hours: Boolean(d.openingHours),
      area: Boolean(d.serviceArea),
    },
  };
}

export type SaveProfileResult =
  | { ok: true }
  | { ok: false; message: string };

export type SaveProfilePayload = {
  businessDescription: string;
  address: string;
  eircode: string;
  firstName: string;
  lastName: string;
  /** Owner's explicit vertical choice from the niche picker. */
  vertical?: string;
};

/**
 * Step 1 — capture salon profile details used for the AI prompt and the
 * public storefront. Address is geocoded (Ireland) so the directory search
 * can sort by distance.
 */
export async function saveProfileStep(
  _: unknown,
  payload: SaveProfilePayload,
): Promise<SaveProfileResult> {
  const session = await requireOnboardingSession();

  const address = payload.address.trim();
  const eircode = payload.eircode.trim();
  const firstName = payload.firstName.trim();
  const lastName = payload.lastName.trim();
  const ownerNameFromForm = joinOwnerName(firstName, lastName);
  const businessDescription = payload.businessDescription.trim();

  if (businessDescription.length < 2) {
    return { ok: false, message: "Describe what kind of business this is." };
  }

  if (looksLikeGibberish(businessDescription)) {
    return {
      ok: false,
      message: "That doesn't look right — tell us what you do in a few words.",
    };
  }

  const {
    agentBusinessType,
    niche: classifiedNiche,
    regulated,
  } = await classifyBusinessDescription(businessDescription);

  // Honour the owner's explicit vertical choice: a "Salon & Beauty" pick keeps
  // the tailored experience even if the free-text description is ambiguous.
  const niche = resolveNicheForVerticalChoice(
    parseVerticalId(payload.vertical),
    classifiedNiche,
  );

  if (regulated && !isOnboardingFreeNavEnabled()) {
    return {
      ok: false,
      message:
        "We don't support medical, legal, or financial services yet — they need extra compliance. Email hello@clistesystems.ie and we'll let you know when that changes.",
    };
  }

  const admin = createAdminClient();
  const [{ data: org }, { data: profile }] = await Promise.all([
    admin
      .from("organizations")
      .select("name, raw_business_description, business_knowledge_summary")
      .eq("id", session.organizationId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("name")
      .eq("id", session.user.id)
      .maybeSingle(),
  ]);

  const businessName = String(org?.name ?? "").trim();
  if (businessName.length < 2) {
    return {
      ok: false,
      message:
        "Business name is missing from your account. Go back to signup or contact support.",
    };
  }

  const profileName = String(profile?.name ?? "").trim();
  const captureOwnerName = ownerNameNeedsCapture(profileName, businessName);

  // Online-only verticals (e.g. e-commerce) don't need a public address.
  const requiresLocation = nicheHasPhysicalLocation(niche);
  if (requiresLocation && !address) {
    return { ok: false, message: "Add your address so callers can be directed." };
  }
  if (requiresLocation && !eircode) {
    return { ok: false, message: "Add your Eircode." };
  }

  if (captureOwnerName || firstName || lastName) {
    if (firstName.length < 1 || lastName.length < 1) {
      return { ok: false, message: "Add your first and last name." };
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        name: ownerNameFromForm,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);

    if (profileError) {
      return { ok: false, message: profileError.message };
    }
  }

  let lat: number | null = null;
  let lng: number | null = null;
  const geoQuery = [address, eircode].filter(Boolean).join(", ");
  if (geoQuery) {
    const g = await geocodeIrelandLocation(geoQuery);
    if (g) {
      lat = g.lat;
      lng = g.lng;
    }
  }

  const locationAddress = address || null;
  const locationEircode = eircode || null;
  const existingRaw = String(org?.raw_business_description ?? "").trim();
  const existingSummary = String(org?.business_knowledge_summary ?? "").trim();
  const seedKnowDraft = !existingRaw && !existingSummary;

  const { error } = await admin
    .from("organizations")
    .update({
      niche,
      agent_business_type: agentBusinessType,
      address: locationAddress,
      storefront_eircode: locationEircode,
      storefront_map_lat: lat,
      storefront_map_lng: lng,
      ...(seedKnowDraft
        ? { raw_business_description: businessDescription }
        : {}),
      // Pre-fill Cara Setup location so onboarding step 5 isn't a repeat.
      ...(locationAddress
        ? { agent_location_address: locationAddress }
        : {}),
      ...(locationEircode
        ? { agent_location_eircode: locationEircode }
        : {}),
      onboarding_step: ONBOARDING_STEPS.voice,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/voice");
}

export type SaveVoiceResult =
  | { ok: true }
  | { ok: false; message: string };

export type SaveVoicePayload = {
  greetingIntro: string;
  greetingClosing: string;
};

export type ReviewVoiceGreetingResult =
  | { ok: true; status: "approved" }
  | {
      ok: true;
      status: "suggestions";
      summary: string;
      greetingIntro?: string;
      greetingClosing?: string;
    }
  | {
      ok: false;
      message: string;
      introIssue?: boolean;
      closingIssue?: boolean;
      rateLimited?: boolean;
    };

export type ValidateVoicePreviewResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      introIssue?: boolean;
      closingIssue?: boolean;
    };

export async function validateVoiceGreetingPreviewStep(
  payload: SaveVoicePayload,
): Promise<ValidateVoicePreviewResult> {
  const session = await requireOnboardingSession();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", session.organizationId)
    .maybeSingle();

  const businessName = String(org?.name ?? "").trim();

  const prepared = await prepareOnboardingVoiceGreetingInput(
    {
      session,
      businessName,
      source: "voice_preview",
    },
    payload,
    { rateLimitScope: null },
  );

  if (!prepared.ok) {
    return {
      ok: false,
      message: prepared.message,
      introIssue: prepared.introIssue,
      closingIssue: prepared.closingIssue,
    };
  }

  return { ok: true };
}

export async function reviewVoiceGreetingStep(
  payload: SaveVoicePayload,
): Promise<ReviewVoiceGreetingResult> {
  const session = await requireOnboardingSession();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", session.organizationId)
    .maybeSingle();

  const businessName = String(org?.name ?? "").trim();

  const prepared = await prepareOnboardingVoiceGreetingInput(
    {
      session,
      businessName,
      source: "onboarding_review",
    },
    payload,
    { rateLimitScope: "greeting_review" },
  );

  if (!prepared.ok) {
    return {
      ok: false,
      message: prepared.message,
      introIssue: prepared.introIssue,
      closingIssue: prepared.closingIssue,
      rateLimited: prepared.rateLimited,
    };
  }

  const outcome = await reviewVoiceGreetingSafe({
    businessName,
    greetingIntro: prepared.greetingIntro,
    greetingClosing: prepared.greetingClosing,
  });

  if (outcome.status === "approved") {
    return { ok: true, status: "approved" };
  }

  return {
    ok: true,
    status: "suggestions",
    summary: outcome.suggestion.summary,
    greetingIntro: outcome.suggestion.greetingIntro,
    greetingClosing: outcome.suggestion.greetingClosing,
  };
}

/**
 * Step 2 — Cara voice + compliant opening greeting.
 */
export async function saveVoiceStep(
  _: unknown,
  payload: SaveVoicePayload,
): Promise<SaveVoiceResult> {
  const session = await requireOnboardingSession();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", session.organizationId)
    .maybeSingle();

  const businessName = String(org?.name ?? "").trim();

  const prepared = await prepareOnboardingVoiceGreetingInput(
    {
      session,
      businessName,
      source: "onboarding_save",
    },
    payload,
    { rateLimitScope: null },
  );

  if (!prepared.ok) {
    return { ok: false, message: prepared.message };
  }

  const greeting = buildFullVoiceGreeting(
    prepared.greetingIntro,
    VOICE_ASSISTANT_DEFAULT_NAME,
    prepared.greetingClosing,
  );

  const nextStep = ONBOARDING_STEPS.knowledge;

  const { error } = await admin
    .from("organizations")
    .update({
      assistant_display_name: VOICE_ASSISTANT_DEFAULT_NAME,
      agent_voice_id: CLISTE_DEFAULT_ELEVENLABS_VOICE_ID,
      greeting,
      onboarding_step: nextStep,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/knowledge");
}

/**
 * Final go-live step — create a Stripe Billing Checkout Session that charges:
 *   - the selected plan's monthly or annual price (licensed line)
 *   - a metered price for per-minute overage (licensed=false line, quantity
 *     grows via usage_records nightly sync)
 *
 * Payment is deferred to here (after the user has built + tested Cara). On
 * success the org is activated. Webhook also sets platform_subscription_id +
 * activates on `checkout.session.completed`.
 */
export async function startPlanCheckout(
  _: unknown,
  formData: FormData,
): Promise<{ ok: false; message: string }> {
  const session = await requireOnboardingSession();

  const rawPlan = String(formData.get("planTier") ?? "").trim();
  const interval = String(formData.get("interval") ?? "month") === "year" ? "year" : "month";

  if (!isPlanTier(rawPlan)) {
    return { ok: false, message: "Pick a plan to continue." };
  }
  if (!planSupportsSelfServeCheckout(rawPlan)) {
    return {
      ok: false,
      message:
        "Custom plans are arranged directly with our team. Email hello@clistesystems.ie to get started.",
    };
  }
  if (formData.get("acceptDpa") !== "on") {
    return {
      ok: false,
      message: "You must accept the Data Processing Agreement to continue.",
    };
  }
  const planTier: PlanTier = rawPlan;
  const launchTier = "diy" as const;

  const h = await headers();
  const securityCtx = buildSecurityEventContext(h);
  const adminForLegal = createAdminClient();
  try {
    await recordLegalAcceptances(adminForLegal, {
      userId: session.user.id,
      organizationId: session.organizationId,
      documents: ["dpa"],
      context: securityCtx,
    });
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Could not record DPA acceptance.",
    };
  }

  await logSecurityEvent(securityCtx, {
    eventType: "legal_acceptance",
    outcome: "success",
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    metadata: {
      documents: ["dpa"],
      organizationId: session.organizationId,
      source: "onboarding_plan",
    },
  });

  if (!PLAN_CHECKOUT_ENABLED) {
    // Billing not wired yet: record the chosen plan, ensure a number, and go live.
    const admin = createAdminClient();
    const plan = PLANS[planTier];
    const { error } = await admin
      .from("organizations")
      .update({
        plan_tier: planTier,
        billing_interval: interval,
        launch_tier: launchTier,
        application_fee_bps: plan.applicationFeeBps,
        platform_subscription_id: "dev_checkout_skipped",
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.organizationId);

    if (error) {
      return { ok: false, message: error.message };
    }

    await provisionPhoneForOrganization(session.organizationId);
    await completeOnboarding();
  }

  await persistOrgBillingSelection({
    organizationId: session.organizationId,
    planTier,
    launchTier,
    interval,
  });

  redirect("/onboarding/plan/checkout");
}

export type OnboardingEmbeddedCheckoutResult =
  | { ok: true; clientSecret: string }
  | { ok: false; message: string };

export async function prepareOnboardingEmbeddedCheckout(): Promise<OnboardingEmbeddedCheckoutResult> {
  const session = await requireOnboardingSession();

  const admin = createAdminClient();
  const missingDpa = await getMissingLegalAcceptances(admin, {
    userId: session.user.id,
    organizationId: session.organizationId,
    needsDpa: true,
  });
  if (missingDpa.includes("dpa")) {
    return {
      ok: false,
      message:
        "Accept the Data Processing Agreement on the plan page before continuing to billing.",
    };
  }

  if (!PLAN_CHECKOUT_ENABLED) {
    return {
      ok: false,
      message: "Plan checkout is not enabled in this environment.",
    };
  }

  const planTier = isPlanTier(session.planTier) ? session.planTier : "pro";
  if (!planSupportsSelfServeCheckout(planTier)) {
    return {
      ok: false,
      message:
        "Custom plans are arranged directly with our team. Email hello@clistesystems.ie to get started.",
    };
  }

  const launchTier = "diy" as const;
  const interval = session.billingInterval === "year" ? "year" : "month";
  const origin = await resolveCheckoutReturnOrigin();

  const result = await createPlatformSubscriptionCheckout({
    organizationId: session.organizationId,
    userEmail: session.user.email ?? undefined,
    planTier,
    launchTier,
    interval,
    checkoutMode: "embedded",
    returnUrl: `${origin}/onboarding/plan?status=return&session_id={CHECKOUT_SESSION_ID}`,
    idempotencyKey: `onboarding-checkout-embedded-${session.organizationId}-${planTier}-${launchTier}`,
  });

  if (!result.ok) return result;
  if (result.mode !== "embedded") {
    return { ok: false, message: "Expected embedded Checkout session." };
  }
  return { ok: true, clientSecret: result.clientSecret };
}

/**
 * Go-live return handler — after Stripe Checkout success, persist the
 * subscription id + customer id, ensure a number, and activate the org.
 */
export async function finalisePlanCheckout(checkoutSessionId: string): Promise<void> {
  const session = await requireOnboardingSession();
  if (!checkoutSessionId?.trim()) return;

  await persistPlatformCheckoutSession(
    session.organizationId,
    checkoutSessionId,
  );

  await provisionPhoneForOrganization(session.organizationId);
  await activateOrganization(session.organizationId);
}

/**
 * Finishes onboarding at go-live. Verifies the org is actually ready
 * (subscription + greeting + number), activates it, and opens the dashboard.
 */
export async function completeOnboarding(): Promise<never> {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("greeting, phone_number, platform_subscription_id")
    .eq("id", session.organizationId)
    .maybeSingle();

  const hasSubscription = Boolean(
    String(org?.platform_subscription_id ?? "").trim(),
  );
  const hasGreeting = String(org?.greeting ?? "").trim().length > 0;

  // In enforced mode, never half-activate: bounce back to the right step.
  if (enforceOnboardingStepOrder() && (!hasSubscription || !hasGreeting)) {
    redirect(resolveCurrentStepPath(session));
  }

  // Best-effort: make sure a number is assigned before going live.
  if (!String(org?.phone_number ?? "").trim()) {
    await provisionPhoneForOrganization(session.organizationId);
  }

  await activateOrganization(session.organizationId);
  redirect("/dashboard?welcome=1");
}

