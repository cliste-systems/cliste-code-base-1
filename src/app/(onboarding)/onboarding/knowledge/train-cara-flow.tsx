"use client";

import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
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
  formatAgentKnowledgeList,
  formatWeekScheduleForAgent,
} from "@/lib/agent-knowledge-format";
import {
  weekScheduleHasOpenDay,
  type BankHolidayConfig,
  type WeekSchedule,
} from "@/lib/business-hours";
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
  persistTrainCaraServicesStep,
  type TrainCaraPayload,
  type TrainCaraSaveResult,
} from "./actions";
import { CaraFaqsStep } from "./cara-faqs-step";
import {
  CaraTextareaStep,
} from "./cara-training-step-shell";
import {
  composeCaptureDetailsNote,
  type CaraCaptureField,
} from "./train-cara-capture-fields";
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
import { resolveServicesStepCopy } from "./train-cara-services-copy";
import { TrainCaraServicesStep } from "./train-cara-services-step";
import { TrainCaraHoursStep } from "./train-cara-hours-step";
import { TrainCaraLocationStep } from "./train-cara-location-step";
import { aboutTextForStep } from "./train-cara-about-text";
import { trainCaraVerticalCopy } from "./train-cara-vertical-copy";
import { TrainCaraIntro } from "./train-cara-intro";
import {
  buildTrainCaraFaqGuardContext,
  sanitizeOnboardingFaqs,
} from "./train-cara-faq-guardrails";

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
  openingHoursSchedule: WeekSchedule;
  open24_7: boolean;
  bankHolidays: BankHolidayConfig;
  hoursNeverConfigured: boolean;
  locationAddress: string;
  baseTown: string;
  locationCounty: string;
  locationEircode: string;
  serviceAreaItems: string[];
  hoursPrefilled: boolean;
  locationPrefilled: boolean;
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
  const [openingHoursSchedule, setOpeningHoursSchedule] = useState(
    initial.openingHoursSchedule,
  );
  const [open24_7, setOpen24_7] = useState(initial.open24_7);
  const [bankHolidays, setBankHolidays] = useState(initial.bankHolidays);
  const [hoursNeverConfigured, setHoursNeverConfigured] = useState(
    initial.hoursNeverConfigured,
  );
  const [locationAddress, setLocationAddress] = useState(initial.locationAddress);
  const [baseTown, setBaseTown] = useState(initial.baseTown);
  const [locationCounty, setLocationCounty] = useState(initial.locationCounty);
  const [locationEircode, setLocationEircode] = useState(initial.locationEircode);
  const [serviceAreaItems, setServiceAreaItems] = useState(initial.serviceAreaItems);
  const [captureFields, setCaptureFields] = useState(initial.captureFields);
  const [faqs, setFaqs] = useState<AgentFaq[]>(initial.faqs);
  const [faqsStrippedNotice, setFaqsStrippedNotice] = useState<string | null>(null);
  const faqsSanitizedOnEnter = useRef(false);

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

  const openingHours = useMemo(() => {
    if (open24_7) return "Open 24 hours, 7 days a week";
    if (!weekScheduleHasOpenDay(openingHoursSchedule)) return "";
    return formatWeekScheduleForAgent(openingHoursSchedule);
  }, [openingHoursSchedule, open24_7]);

  const serviceArea = useMemo(
    () => formatAgentKnowledgeList(serviceAreaItems),
    [serviceAreaItems],
  );

  const faqGuardContext = useMemo(
    () =>
      buildTrainCaraFaqGuardContext({
        openingHoursSchedule,
        open24_7,
        hoursNeverConfigured,
        locationAddress,
        baseTown,
        locationCounty,
        locationEircode,
        serviceAreaItems,
        servicesOffered,
        serviceCatalogCount: serviceCatalog.length,
      }),
    [
      openingHoursSchedule,
      open24_7,
      hoursNeverConfigured,
      locationAddress,
      baseTown,
      locationCounty,
      locationEircode,
      serviceAreaItems,
      servicesOffered,
      serviceCatalog.length,
    ],
  );

  useEffect(() => {
    if (step.id !== "faqs") {
      faqsSanitizedOnEnter.current = false;
      return;
    }
    if (faqsSanitizedOnEnter.current) return;
    faqsSanitizedOnEnter.current = true;

    setFaqs((current) => {
      const next = sanitizeOnboardingFaqs(current, faqGuardContext);
      const removed = current.length - next.length;
      if (removed > 0) {
        setFaqsStrippedNotice(
          removed === 1
            ? "We removed 1 question that duplicated your hours, location, or services — Cara already knows that from earlier steps."
            : `We removed ${removed} questions that duplicated your hours, location, or services — Cara already knows those from earlier steps.`,
        );
      }
      return next;
    });
  }, [step.id, faqGuardContext]);

  const canFinishLater =
    step.id === "services" ||
    step.id === "hours" ||
    step.id === "location" ||
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
      businessHours: openingHoursSchedule,
      open24_7,
      bankHolidays,
      locationAddress: locationAddress.trim(),
      baseTown: baseTown.trim(),
      locationCounty: locationCounty.trim(),
      locationEircode: locationEircode.trim(),
    };
  }

  function validateStep(): string | null {
    if (step.id === "about" && about.trim().length < MIN_ABOUT_LENGTH) {
      return `Tell Cara a little more about the business (at least ${MIN_ABOUT_LENGTH} characters).`;
    }
    if (
      step.id === "hours" &&
      !open24_7 &&
      !weekScheduleHasOpenDay(openingHoursSchedule)
    ) {
      return "Set opening hours for at least one day, or choose Open 24/7.";
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
      case "hours":
        return (
          <TrainCaraHoursStep
            title={verticalCopy.hours.title}
            subtitle={verticalCopy.hours.subtitle}
            helper={verticalCopy.hours.helper}
            openingHoursSchedule={openingHoursSchedule}
            onOpeningHoursScheduleChange={(next) => {
              setHoursNeverConfigured(false);
              setOpeningHoursSchedule(next);
            }}
            open24_7={open24_7}
            onOpen24_7Change={(next) => {
              setHoursNeverConfigured(false);
              setOpen24_7(next);
            }}
            bankHolidays={bankHolidays}
            onBankHolidaysChange={setBankHolidays}
            hoursNeverConfigured={hoursNeverConfigured}
            prefilledNotice={
              initial.hoursPrefilled
                ? "We pulled your opening hours from your website — tweak anything that looks off."
                : undefined
            }
            disabled={busy}
          />
        );
      case "location":
        return (
          <TrainCaraLocationStep
            title={verticalCopy.location.title}
            subtitle={verticalCopy.location.subtitle}
            helper={verticalCopy.location.helper}
            locationAddress={locationAddress}
            onLocationAddressChange={setLocationAddress}
            baseTown={baseTown}
            onBaseTownChange={setBaseTown}
            locationCounty={locationCounty}
            onLocationCountyChange={setLocationCounty}
            locationEircode={locationEircode}
            onLocationEircodeChange={setLocationEircode}
            prefilledNotice={
              initial.locationPrefilled
                ? "We pulled your address from your website — add town or county if needed."
                : undefined
            }
            showServiceArea={!skipServiceArea}
            serviceAreaItems={serviceAreaItems}
            onServiceAreaItemsChange={setServiceAreaItems}
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
            guardContext={faqGuardContext}
            strippedNotice={faqsStrippedNotice}
            onChange={setFaqs}
          />
        );
      default:
        return null;
    }
  }

  if (phase === "intro") {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden">
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
      </div>
    );
  }

  const continueLabel = isLast ? "Continue" : "Save and continue";

  return (
    <div className="w-full">
      <div
        className={cn(
          TRAIN_CARA_CONTENT_WIDTH,
          "mx-auto flex w-full flex-col items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4",
        )}
      >
        <OnboardingStepPanel
          stepKey={step.id}
          className="flex w-full flex-col items-center gap-3 sm:gap-4"
        >
          <OnboardingEnterProvider>
            <div className="flex w-full flex-col items-center gap-3 sm:gap-4">
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

              <OnboardingEnter className="flex w-full flex-col items-center gap-2.5 border-t border-slate-200/60 pt-3">
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
                  className={cn(
                    ONBOARDING_SECONDARY_BUTTON,
                    "shadow-none hover:shadow-none",
                  )}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Back
                </button>
                <OnboardingPrimaryButton
                  type="button"
                  pending={busy}
                  onClick={handleContinue}
                  className="min-w-[12rem] shadow-none hover:shadow-none"
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
    </div>
  );
}
