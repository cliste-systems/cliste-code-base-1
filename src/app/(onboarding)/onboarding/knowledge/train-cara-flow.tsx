"use client";

import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  startTransition,
  useTransition,
} from "react";
import { ArrowRight, ChevronLeft, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { type SavedRoute } from "@/app/(dashboard)/dashboard/routing/route-models";
import { useOnboardingKnowledgeNav } from "@/components/onboarding/onboarding-knowledge-nav";
import { OnboardingEnter, OnboardingEnterProvider } from "@/components/onboarding/onboarding-enter";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { OnboardingStepPanel } from "@/components/onboarding/onboarding-step-panel";
import {
  ONBOARDING_LOGO_SIZE,
  ONBOARDING_SECONDARY_BUTTON,
} from "@/components/onboarding/onboarding-ui";
import {
  multilineTextToRules,
  rulesToMultilineText,
} from "@/lib/agent-business-rules";
import { normalizeCaraTrainingVoice } from "@/lib/cara-starter-notes";
import {
  isOnboardingUiCopyFresh,
  type OnboardingUiCopy,
} from "@/lib/onboarding-ui-copy-shared";
import { cn } from "@/lib/utils";

import {
  completeTrainCaraStep,
  skipTrainCaraStep,
  ensureOnboardingUiCopy,
  saveTrainCaraProgress,
  type TrainCaraPayload,
  type TrainCaraSaveResult,
} from "./actions";
import { CaraFaqsStep } from "./cara-faqs-step";
import { CaraReviewStep } from "./cara-review-step";
import {
  buildReviewPageContent,
  buildReviewPages,
} from "./train-cara-review-pages";
import {
  CaraDualTextareaStep,
  CaraTextareaStep,
} from "./cara-training-step-shell";
import { captureFieldsFromDetailsText } from "./train-cara-capture-text";
import { composeCaptureDetailsNote } from "./train-cara-capture-fields";
import { compileCaraPhoneNotes } from "./train-cara-compile-notes";
import {
  CARA_HANDLE_OPTIONS,
  MIN_ABOUT_LENGTH,
  TRAIN_CARA_CONTENT_WIDTH,
  TRAIN_CARA_STEPS,
  ensureRequiredHandleOptions,
  type CaraHandleOptionId,
} from "./train-cara-constants";
import { resolveServicesStepCopy } from "./train-cara-services-copy";
import { aboutTextForStep } from "./train-cara-about-text";
import { trainCaraVerticalCopy } from "./train-cara-vertical-copy";
import { TrainCaraIntro } from "./train-cara-intro";

const INITIAL: TrainCaraSaveResult = { ok: false, message: "" };

export type TrainCaraInitial = {
  businessName: string;
  about: string;
  servicesOffered: string;
  servicesNotOffered: string;
  openingHours: string;
  serviceArea: string;
  detailsToCollect: string;
  businessRules: string[];
  compiledNotes: string;
  faqs: AgentFaq[];
  businessType: string;
  niche: string;
  handleOptions: CaraHandleOptionId[];
  routes: SavedRoute[];
  linkLabel: string;
  linkUrl: string;
  emailAddress: string;
  whatsappContact: string;
  meetingLink: string;
  transferPhone: string;
  onboardingUiCopy: OnboardingUiCopy | null;
  showIntro: boolean;
  initialStepIndex: number;
};

const VALID_HANDLE_IDS = new Set(CARA_HANDLE_OPTIONS.map((option) => option.id));

function sanitizeHandleOptions(options: CaraHandleOptionId[]): CaraHandleOptionId[] {
  return ensureRequiredHandleOptions(
    options.filter((id) => VALID_HANDLE_IDS.has(id)),
  );
}

function clampStepIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), TRAIN_CARA_STEPS.length - 1);
}

function applyDetailsToRoutes(
  routes: SavedRoute[],
  details: Pick<
    TrainCaraInitial,
    "linkLabel" | "linkUrl" | "emailAddress" | "whatsappContact" | "meetingLink"
  > & { captureDetailsNote: string },
): SavedRoute[] {
  return routes.map((route) => {
    if (route.outcome === "send_link") {
      const url = details.meetingLink.trim() || details.linkUrl.trim();
      if (!url) return route;
      return { ...route, url };
    }
    if (route.outcome === "email" && details.emailAddress.trim()) {
      return { ...route, email: details.emailAddress.trim() };
    }
    if (route.outcome === "whatsapp" && details.whatsappContact.trim()) {
      return { ...route, whatsapp: details.whatsappContact.trim() };
    }
    if (route.outcome === "action_inbox" && details.captureDetailsNote.trim()) {
      return { ...route, note: details.captureDetailsNote.trim() };
    }
    return route;
  });
}

export function TrainCaraFlow({ initial }: { initial: TrainCaraInitial }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setInternalStepIndex } = useOnboardingKnowledgeNav();

  const [phase, setPhase] = useState<"intro" | "training">(
    initial.showIntro ? "intro" : "training",
  );
  const [stepIndex, setStepIndex] = useState(() =>
    clampStepIndex(initial.initialStepIndex),
  );

  const [about, setAbout] = useState(() => aboutTextForStep(initial.about));
  const [servicesOffered, setServicesOffered] = useState(initial.servicesOffered);
  const [servicesNotOffered, setServicesNotOffered] = useState(
    initial.servicesNotOffered,
  );
  const [openingHours, setOpeningHours] = useState(initial.openingHours);
  const [serviceArea, setServiceArea] = useState(initial.serviceArea);
  const [detailsToCollect, setDetailsToCollect] = useState(
    initial.detailsToCollect.trim(),
  );
  const [rulesText, setRulesText] = useState(
    rulesToMultilineText(initial.businessRules),
  );
  const [faqs, setFaqs] = useState<AgentFaq[]>(initial.faqs);

  const [handleOptions] = useState<CaraHandleOptionId[]>(() =>
    sanitizeHandleOptions(initial.handleOptions),
  );
  const [routes] = useState<SavedRoute[]>(initial.routes);
  const [onboardingUiCopy, setOnboardingUiCopy] = useState<OnboardingUiCopy | null>(
    initial.onboardingUiCopy,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [savingProgress, startSaveProgress] = useTransition();
  const [skippingIntro, startSkipIntro] = useTransition();
  const [state, formAction, pending] = useActionState(completeTrainCaraStep, INITIAL);

  const businessRules = useMemo(
    () => multilineTextToRules(rulesText),
    [rulesText],
  );

  const reviewContent = useMemo(
    () =>
      buildReviewPageContent({
        about,
        servicesOffered,
        servicesNotOffered,
        openingHours,
        serviceArea,
        detailsToCollect,
        businessRules,
        faqs,
      }),
    [
      about,
      servicesOffered,
      servicesNotOffered,
      openingHours,
      serviceArea,
      detailsToCollect,
      businessRules,
      faqs,
    ],
  );

  const reviewPages = useMemo(
    () => buildReviewPages(reviewContent, initial.businessName),
    [reviewContent, initial.businessName],
  );

  const [reviewPageIndex, setReviewPageIndex] = useState(0);

  const step = TRAIN_CARA_STEPS[stepIndex]!;
  const isLast = stepIndex === TRAIN_CARA_STEPS.length - 1;
  const busy = pending || savingProgress || skippingIntro;

  useLayoutEffect(() => {
    if (phase === "intro") return;
    setInternalStepIndex(stepIndex);
  }, [phase, stepIndex, setInternalStepIndex]);

  useEffect(() => {
    if (step.id === "review") {
      // Reset to the first review page whenever we (re)enter the review step.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReviewPageIndex(0);
    }
  }, [stepIndex, step.id]);

  useEffect(() => {
    if (phase === "intro") return;
    const stepId = TRAIN_CARA_STEPS[stepIndex]?.id;
    if (!stepId) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("step") === stepId) return;

    params.set("step", stepId);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [phase, stepIndex, pathname, router]);

  const autoCompiledNotes = useMemo(
    () =>
      compileCaraPhoneNotes({
        businessName: initial.businessName,
        about,
        servicesOffered,
        servicesNotOffered,
        openingHours,
        serviceArea,
        detailsToCollect,
        rules: businessRules,
        faqs,
      }),
    [
      initial.businessName,
      about,
      servicesOffered,
      servicesNotOffered,
      openingHours,
      serviceArea,
      detailsToCollect,
      businessRules,
      faqs,
    ],
  );

  const verticalCopy = useMemo(
    () => trainCaraVerticalCopy(initial.niche),
    [initial.niche],
  );
  const aboutCopy = verticalCopy.about;

  const servicesCopy = useMemo(
    () =>
      resolveServicesStepCopy({
        businessType: initial.businessType,
        niche: initial.niche,
        uiCopy: onboardingUiCopy,
      }),
    [initial.businessType, initial.niche, onboardingUiCopy],
  );

  useEffect(() => {
    if (phase !== "training") return;
    if (step.id !== "services" && step.id !== "faqs") return;

    const description = about.trim();
    if (description.length < 20) return;

    const type = initial.businessType.trim();
    if (
      isOnboardingUiCopyFresh(onboardingUiCopy, {
        businessType: type,
        rawBusinessDescription: description,
      })
    ) {
      return;
    }

    let cancelled = false;

    void ensureOnboardingUiCopy({
      businessType: type || undefined,
      niche: initial.niche || undefined,
      rawBusinessDescription: description,
      openingHours: openingHours.trim(),
      serviceArea: serviceArea.trim(),
      servicesOffered: servicesOffered.trim(),
    }).then((result) => {
      if (cancelled) return;
      if (result.ok) setOnboardingUiCopy(result.copy);
    });

    return () => {
      cancelled = true;
    };
  }, [
    phase,
    step.id,
    about,
    initial.businessType,
    initial.niche,
    openingHours,
    serviceArea,
    servicesOffered,
    onboardingUiCopy,
  ]);

  function buildCompiledNotes(): string {
    return normalizeCaraTrainingVoice(autoCompiledNotes);
  }

  function payloadFromState(
    overrides: Partial<Pick<TrainCaraPayload, "trainCaraStep">> = {},
  ): TrainCaraPayload {
    const captureFields = captureFieldsFromDetailsText(detailsToCollect);
    const captureDetailsNote = composeCaptureDetailsNote(captureFields);
    const summary = buildCompiledNotes();
    const selectedHandles = sanitizeHandleOptions(handleOptions);
    const builtRoutes = applyDetailsToRoutes(routes, {
      linkLabel: initial.linkLabel,
      linkUrl: initial.linkUrl,
      emailAddress: initial.emailAddress,
      whatsappContact: initial.whatsappContact,
      meetingLink: initial.meetingLink,
      captureDetailsNote,
    });

    return {
      rawBusinessDescription: about.trim(),
      businessKnowledgeSummary: summary,
      openingHours: openingHours.trim(),
      serviceArea: serviceArea.trim(),
      servicesOffered: servicesOffered.trim(),
      servicesNotOffered: servicesNotOffered.trim(),
      detailsToCollect: detailsToCollect.trim(),
      faqs,
      businessRules,
      captureFields,
      handleOptions: selectedHandles,
      routes: builtRoutes,
      captureDetailsNote,
      linkLabel: initial.linkLabel,
      linkUrl: initial.linkUrl,
      emailAddress: initial.emailAddress,
      whatsappContact: initial.whatsappContact,
      meetingLink: initial.meetingLink,
      transferPhone: initial.transferPhone,
      trainCaraStep: overrides.trainCaraStep ?? step.id,
      onboardingUiCopy: onboardingUiCopy ?? undefined,
      preserveFaqs: step.id !== "faqs" && step.id !== "review",
    };
  }

  function validateStep(): string | null {
    if (step.id === "about" && about.trim().length < MIN_ABOUT_LENGTH) {
      return `Tell Cara a little more about the business (at least ${MIN_ABOUT_LENGTH} characters).`;
    }
    if (step.id === "review" && !buildCompiledNotes().trim()) {
      return "Cara needs phone notes before you continue.";
    }
    return null;
  }

  function persistProgress(
    onDone: () => void,
    options: Partial<Pick<TrainCaraPayload, "trainCaraStep">> = {},
  ) {
    setLocalError(null);
    startSaveProgress(async () => {
      const result = await saveTrainCaraProgress(payloadFromState(options));
      if (!result.ok) {
        setLocalError(result.message);
        return;
      }
      onDone();
    });
  }

  function advanceToStep(nextIndex: number) {
    const nextStep = TRAIN_CARA_STEPS[nextIndex];
    if (!nextStep) return;
    persistProgress(() => setStepIndex(nextIndex), { trainCaraStep: nextStep.id });
  }

  function handleContinue() {
    setLocalError(null);
    const validationError = validateStep();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    if (step.id === "review") {
      if (reviewPages.length === 0 || reviewPageIndex >= reviewPages.length - 1) {
        startTransition(() => formAction(payloadFromState()));
        return;
      }
      setReviewPageIndex((index) => index + 1);
      return;
    }

    if (isLast) {
      startTransition(() => formAction(payloadFromState()));
      return;
    }

    advanceToStep(Math.min(TRAIN_CARA_STEPS.length - 1, stepIndex + 1));
  }

  function handleBack() {
    setLocalError(null);
    if (step.id === "review" && reviewPageIndex > 0) {
      setReviewPageIndex((index) => index - 1);
      return;
    }
    if (stepIndex === 0) {
      setPhase("intro");
      router.replace(pathname, { scroll: false });
      return;
    }
    const nextIndex = Math.max(0, stepIndex - 1);
    advanceToStep(nextIndex);
  }

  function handleIntroBack() {
    router.push("/onboarding/voice");
  }

  function handleIntroSkip() {
    setLocalError(null);
    startSkipIntro(async () => {
      try {
        await skipTrainCaraStep();
      } catch (error) {
        setLocalError(
          error instanceof Error ? error.message : "Could not skip this step.",
        );
      }
    });
  }

  function handleStartTraining() {
    setPhase("training");
    setStepIndex(0);
    persistProgress(() => {}, { trainCaraStep: "about" });
    const params = new URLSearchParams(window.location.search);
    params.set("step", "about");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const formError = localError || (!state.ok && state.message ? state.message : null);

  function renderStep() {
    switch (step.id) {
      case "about":
        return (
          <CaraTextareaStep
            title={aboutCopy.title}
            subtitle={aboutCopy.subtitle}
            helper={aboutCopy.helper}
            value={about}
            onChange={setAbout}
            placeholder={verticalCopy.placeholders.about}
            disabled={busy}
            expandable
          />
        );
      case "services":
        return (
          <CaraDualTextareaStep
            title={step.title}
            subtitle={servicesCopy.subtitle}
            helper={servicesCopy.helper}
            primaryLabel={servicesCopy.primaryLabel}
            primaryValue={servicesOffered}
            primaryPlaceholder={servicesCopy.primaryPlaceholder}
            secondaryLabel={servicesCopy.secondaryLabel}
            secondaryValue={servicesNotOffered}
            secondaryPlaceholder={servicesCopy.secondaryPlaceholder}
            onPrimaryChange={setServicesOffered}
            onSecondaryChange={setServicesNotOffered}
            disabled={busy}
          />
        );
      case "hours":
        return (
          <CaraDualTextareaStep
            title={verticalCopy.hours.title}
            subtitle={verticalCopy.hours.subtitle}
            helper={verticalCopy.hours.helper}
            primaryLabel={verticalCopy.labels.openingHours}
            primaryValue={openingHours}
            primaryPlaceholder={verticalCopy.placeholders.openingHours}
            secondaryLabel={verticalCopy.labels.serviceArea}
            secondaryValue={serviceArea}
            secondaryPlaceholder={verticalCopy.placeholders.serviceArea}
            onPrimaryChange={setOpeningHours}
            onSecondaryChange={setServiceArea}
            disabled={busy}
          />
        );
      case "capture":
        return (
          <CaraDualTextareaStep
            title={verticalCopy.capture.title}
            subtitle={verticalCopy.capture.subtitle}
            helper={verticalCopy.capture.helper}
            primaryLabel={verticalCopy.labels.detailsToCollect}
            primaryValue={detailsToCollect}
            primaryPlaceholder={verticalCopy.placeholders.detailsToCollect}
            secondaryLabel={verticalCopy.labels.rules}
            secondaryValue={rulesText}
            secondaryPlaceholder={verticalCopy.placeholders.rules}
            onPrimaryChange={setDetailsToCollect}
            onSecondaryChange={setRulesText}
            disabled={busy}
          />
        );
      case "faqs":
        return (
          <CaraFaqsStep
            title={verticalCopy.faqs.title}
            subtitle={verticalCopy.faqs.subtitle}
            helper={verticalCopy.faqs.helper}
            businessType={initial.businessType}
            niche={initial.niche}
            faqs={faqs}
            disabled={busy}
            suggestContext={{
              businessType: initial.businessType,
              niche: initial.niche,
              about,
              servicesOffered,
              serviceArea,
              openingHours,
              servicesNotOffered,
            }}
            uiCopy={onboardingUiCopy}
            onChange={setFaqs}
          />
        );
      case "review":
        return (
          <CaraReviewStep
            pages={reviewPages}
            pageIndex={reviewPageIndex}
            disabled={busy}
          />
        );
      default:
        return null;
    }
  }

  if (phase === "intro") {
    return (
      <div className={TRAIN_CARA_CONTENT_WIDTH}>
        <OnboardingStepPanel stepKey="intro" className="flex w-full flex-col items-center">
          <OnboardingEnterProvider>
            <OnboardingEnter className="mb-3 flex w-full justify-center">
              <ClisteLogoMark
                size={ONBOARDING_LOGO_SIZE}
                priority
                className="mx-auto"
              />
            </OnboardingEnter>
          </OnboardingEnterProvider>
          <TrainCaraIntro
            onStart={handleStartTraining}
            onBack={handleIntroBack}
            onSkip={handleIntroSkip}
            skipPending={skippingIntro}
            disabled={busy}
          />
          {(localError || formError) ? (
            <p className="mt-4 text-center text-[13px] text-red-600" role="alert">
              {localError ?? formError}
            </p>
          ) : null}
        </OnboardingStepPanel>
      </div>
    );
  }

  const isLastReviewPage =
    step.id === "review" &&
    (reviewPages.length === 0 || reviewPageIndex >= reviewPages.length - 1);
  const continueLabel = step.id === "review"
    ? isLastReviewPage
      ? "Continue"
      : "Next"
    : "Save and continue";
  const reviewStepKey =
    step.id === "review" ? `review-${reviewPageIndex}` : step.id;

  return (
    <div className="flex w-full flex-col items-center">
      <OnboardingStepPanel
        stepKey={reviewStepKey}
        className={cn(
          "flex w-full flex-col items-center",
          step.id === "review" ? "gap-3" : "gap-5",
        )}
      >
        <OnboardingEnterProvider>
          <div className="flex w-full flex-col items-center gap-5">
            <OnboardingEnter className="flex w-full justify-center">
              <ClisteLogoMark
                size={ONBOARDING_LOGO_SIZE}
                priority
                className="mx-auto"
              />
            </OnboardingEnter>
            <OnboardingEnter className="w-full">{renderStep()}</OnboardingEnter>

            {formError ? (
              <p className="w-full text-center text-[13px] text-red-600" role="alert">
                {formError}
              </p>
            ) : null}

            <OnboardingEnter className="flex w-full items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={handleBack}
                disabled={busy}
                className={ONBOARDING_SECONDARY_BUTTON}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </button>
              <OnboardingPrimaryButton
                type="button"
                pending={busy}
                onClick={handleContinue}
                className="min-w-[12rem]"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  <>
                    {continueLabel}
                    <ArrowRight className="size-4" aria-hidden />
                  </>
                )}
              </OnboardingPrimaryButton>
            </OnboardingEnter>
          </div>
        </OnboardingEnterProvider>
      </OnboardingStepPanel>
    </div>
  );
}
