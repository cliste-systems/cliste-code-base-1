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
import { isValidHttpUrl } from "@/app/(dashboard)/dashboard/routing/routing-validation";
import { useOnboardingKnowledgeNav } from "@/components/onboarding/onboarding-knowledge-nav";
import { OnboardingEnter, OnboardingEnterProvider } from "@/components/onboarding/onboarding-enter";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { OnboardingStepPanel } from "@/components/onboarding/onboarding-step-panel";
import {
  ONBOARDING_LOGO_SIZE,
  ONBOARDING_SECONDARY_BUTTON,
} from "@/components/onboarding/onboarding-ui";
import { normalizeCaraTrainingVoice } from "@/lib/cara-starter-notes";
import {
  isOnboardingUiCopyFresh,
  type OnboardingUiCopy,
} from "@/lib/onboarding-ui-copy-shared";
import type { CaraGoal } from "@/lib/cara-goal";
import { verticalPackForNiche } from "@/lib/verticals";
import type { ServiceCatalogItem } from "@/lib/service-catalog-format";
import { cn } from "@/lib/utils";

import {
  completeTrainCaraStep,
  skipTrainCaraStep,
  ensureOnboardingUiCopy,
  saveTrainCaraProgress,
  persistTrainCaraExclusionsStep,
  persistTrainCaraServicesStep,
  type TrainCaraPayload,
  type TrainCaraSaveResult,
} from "./actions";
import { CaraFaqsStep } from "./cara-faqs-step";
import {
  CaraDualTextareaStep,
  CaraTextareaStep,
} from "./cara-training-step-shell";
import {
  composeCaptureDetailsNote,
  type CaraCaptureField,
} from "./train-cara-capture-fields";
import { TrainCaraCaptureStep } from "./train-cara-capture-step";
import { compileCaraPhoneNotes } from "./train-cara-compile-notes";
import {
  CARA_HANDLE_OPTIONS,
  MIN_ABOUT_LENGTH,
  TRAIN_CARA_CONTENT_WIDTH,
  TRAIN_CARA_STEPS,
  ensureRequiredHandleOptions,
  type CaraHandleOptionId,
  type TrainCaraStepId,
} from "./train-cara-constants";
import { resolveServicesStepCopy, resolveExclusionsStepCopy } from "./train-cara-services-copy";
import { TrainCaraServicesStep } from "./train-cara-services-step";
import { TrainCaraExclusionsStep } from "./train-cara-exclusions-step";
import { aboutTextForStep } from "./train-cara-about-text";
import { trainCaraVerticalCopy } from "./train-cara-vertical-copy";
import { TrainCaraIntro } from "./train-cara-intro";

const INITIAL: TrainCaraSaveResult = { ok: false, message: "" };

function stepIndexForId(id: TrainCaraStepId): number {
  const index = TRAIN_CARA_STEPS.findIndex((item) => item.id === id);
  return index >= 0 ? index : 0;
}

export type TrainCaraInitial = {
  businessName: string;
  about: string;
  servicesOffered: string;
  servicesOfferedRaw: string;
  servicesNotOffered: string;
  servicesNotOfferedRaw: string;
  openingHours: string;
  serviceArea: string;
  captureFields: CaraCaptureField[];
  faqs: AgentFaq[];
  businessType: string;
  niche: string;
  caraGoal: CaraGoal;
  serviceCatalog: ServiceCatalogItem[];
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
      if (!url || !isValidHttpUrl(url)) return route;
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
  const [servicesOfferedRaw, setServicesOfferedRaw] = useState(
    initial.servicesOfferedRaw,
  );
  const [servicesNotOffered, setServicesNotOffered] = useState(
    initial.servicesNotOffered,
  );
  const [servicesNotOfferedRaw, setServicesNotOfferedRaw] = useState(
    initial.servicesNotOfferedRaw || initial.servicesNotOffered,
  );
  const [serviceCatalog, setServiceCatalog] = useState(initial.serviceCatalog);
  const [openingHours, setOpeningHours] = useState(initial.openingHours);
  const [serviceArea, setServiceArea] = useState(initial.serviceArea);
  const [captureFields, setCaptureFields] = useState(initial.captureFields);
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
  const [finishingLater, startFinishLater] = useTransition();
  const [state, formAction, pending] = useActionState(completeTrainCaraStep, INITIAL);

  const detailsToCollect = useMemo(
    () => composeCaptureDetailsNote(captureFields),
    [captureFields],
  );

  const step = TRAIN_CARA_STEPS[stepIndex]!;
  const isLast = stepIndex === TRAIN_CARA_STEPS.length - 1;
  const busy = pending || savingProgress || finishingLater;

  const skipServiceArea = verticalPackForNiche(initial.niche).capabilities
    .skipServiceArea;

  const canFinishLater =
    step.id === "services" ||
    step.id === "exclusions" ||
    step.id === "hours" ||
    step.id === "capture" ||
    step.id === "faqs";

  useLayoutEffect(() => {
    if (phase === "intro") return;
    setInternalStepIndex(stepIndex);
  }, [phase, stepIndex, setInternalStepIndex]);

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
      faqs,
    ],
  );

  const verticalCopy = useMemo(
    () => trainCaraVerticalCopy(initial.niche, initial.caraGoal),
    [initial.niche, initial.caraGoal],
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

  const exclusionsCopy = useMemo(
    () =>
      resolveExclusionsStepCopy({
        businessType: initial.businessType,
        niche: initial.niche,
        servicesCopy,
      }),
    [initial.businessType, initial.niche, servicesCopy],
  );

  useEffect(() => {
    if (phase !== "training") return;
    if (step.id !== "services" && step.id !== "faqs") return;

    const description = about.trim();
    if (description.length < 20) return;

    const type = initial.businessType.trim();
    if (
      isOnboardingUiCopyFresh(onboardingUiCopy, {
        niche: initial.niche,
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
      serviceArea: skipServiceArea ? "" : serviceArea.trim(),
      servicesOffered: servicesOffered.trim(),
      servicesOfferedRaw: servicesOfferedRaw.trim(),
      servicesNotOffered: servicesNotOffered.trim(),
      servicesNotOfferedRaw: servicesNotOfferedRaw.trim(),
      detailsToCollect: detailsToCollect.trim(),
      faqs,
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
      preserveFaqs: step.id !== "faqs",
    };
  }

  function validateStep(): string | null {
    if (step.id === "about" && about.trim().length < MIN_ABOUT_LENGTH) {
      return `Tell Cara a little more about the business (at least ${MIN_ABOUT_LENGTH} characters).`;
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

    if (step.id === "services") {
      const nextIndex = Math.min(TRAIN_CARA_STEPS.length - 1, stepIndex + 1);
      const nextStep = TRAIN_CARA_STEPS[nextIndex];
      if (!nextStep) return;
      startSaveProgress(async () => {
        const result = await persistTrainCaraServicesStep({
          ...payloadFromState({ trainCaraStep: nextStep.id }),
        });
        if (!result.ok) {
          setLocalError(result.message);
          return;
        }
        if (result.offerings) {
          setServicesOffered(result.offerings);
        }
        setStepIndex(nextIndex);
      });
      return;
    }

    if (step.id === "exclusions") {
      const nextIndex = Math.min(TRAIN_CARA_STEPS.length - 1, stepIndex + 1);
      const nextStep = TRAIN_CARA_STEPS[nextIndex];
      if (!nextStep) return;
      startSaveProgress(async () => {
        const result = await persistTrainCaraExclusionsStep(
          payloadFromState({ trainCaraStep: nextStep.id }),
        );
        if (!result.ok) {
          setLocalError(result.message);
          return;
        }
        if (result.formatted != null) {
          setServicesNotOffered(result.formatted);
        }
        setStepIndex(nextIndex);
      });
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

  function handleFinishLater() {
    setLocalError(null);
    startFinishLater(async () => {
      const result = await skipTrainCaraStep();
      if (result && !result.ok) {
        setLocalError(result.message);
      }
    });
  }

  function handleServicesNotOfferedRawChange(value: string) {
    setServicesNotOfferedRaw(value);
    if (!value.trim()) {
      setServicesNotOffered("");
    }
  }

  function handleSkipServices() {
    if (step.id !== "services") return;
    setLocalError(null);
    const targetIndex =
      initial.caraGoal === "faq_only"
        ? stepIndexForId("hours")
        : stepIndex + 1;
    const targetStep = TRAIN_CARA_STEPS[targetIndex];
    if (!targetStep) return;
    startSaveProgress(async () => {
      const result = await persistTrainCaraServicesStep({
        ...payloadFromState({ trainCaraStep: targetStep.id }),
        extractOfferings: false,
      });
      if (!result.ok) {
        setLocalError(result.message);
        return;
      }
      setStepIndex(targetIndex);
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
          <TrainCaraServicesStep
            title={step.title}
            subtitle={servicesCopy.subtitle}
            helper={servicesCopy.helper}
            niche={initial.niche}
            caraGoal={initial.caraGoal}
            servicesCopy={servicesCopy}
            catalog={serviceCatalog}
            bookingLinkUrl={initial.linkUrl}
            servicesOfferedRaw={servicesOfferedRaw}
            onCatalogChange={(services, offered) => {
              setServiceCatalog(services);
              setServicesOffered(offered);
              if (services.length > 0) {
                setServicesOfferedRaw("");
              }
            }}
            onServicesOfferedRawChange={setServicesOfferedRaw}
            onSkip={
              initial.caraGoal === "faq_only" ? handleSkipServices : undefined
            }
            disabled={busy}
          />
        );
      case "exclusions":
        return (
          <TrainCaraExclusionsStep
            title={step.title}
            subtitle={exclusionsCopy.subtitle}
            exclusionsCopy={exclusionsCopy}
            servicesNotOfferedRaw={servicesNotOfferedRaw}
            servicesNotOffered={servicesNotOffered}
            onServicesNotOfferedRawChange={handleServicesNotOfferedRawChange}
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
          <TrainCaraCaptureStep
            title={verticalCopy.capture.title}
            subtitle={verticalCopy.capture.subtitle}
            helper={verticalCopy.capture.helper}
            captureFields={captureFields}
            onCaptureFieldsChange={setCaptureFields}
            businessType={initial.businessType}
            niche={initial.niche}
            caraGoal={initial.caraGoal}
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
            niche={initial.niche}
            onStart={handleStartTraining}
            onBack={handleIntroBack}
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

  const continueLabel = isLast ? "Continue" : "Save and continue";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center">
      <OnboardingStepPanel
        stepKey={step.id}
        className="flex min-h-0 w-full flex-1 flex-col items-center gap-4"
      >
        <OnboardingEnterProvider>
          <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-4">
            <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-4 overflow-y-auto overscroll-y-contain">
              <OnboardingEnter className="flex w-full shrink-0 justify-center">
                <ClisteLogoMark
                  size={ONBOARDING_LOGO_SIZE}
                  priority
                  className="mx-auto"
                />
              </OnboardingEnter>
              <OnboardingEnter className="w-full shrink-0">
                {renderStep()}
              </OnboardingEnter>

              {formError ? (
                <p className="w-full shrink-0 text-center text-[13px] text-red-600" role="alert">
                  {formError}
                </p>
              ) : null}
            </div>

            <OnboardingEnter className="flex w-full shrink-0 flex-col items-center justify-center gap-2.5 border-t border-slate-200/60 pt-3">
              {canFinishLater ? (
                <button
                  type="button"
                  onClick={handleFinishLater}
                  disabled={busy}
                  className={cn(
                    ONBOARDING_SECONDARY_BUTTON,
                    "h-auto min-h-10 w-full max-w-md px-3 py-2.5 text-[12px] leading-snug sm:text-[13px]",
                  )}
                >
                  {finishingLater ? "Saving…" : "Finish later"}
                </button>
              ) : null}
              <div className="flex w-full items-center justify-center gap-3">
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
              </div>
            </OnboardingEnter>
          </div>
        </OnboardingEnterProvider>
      </OnboardingStepPanel>
    </div>
  );
}
