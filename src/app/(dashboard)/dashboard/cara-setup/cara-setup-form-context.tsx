"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  formatAgentKnowledgeList,
  formatWeekScheduleForAgent,
} from "@/lib/agent-knowledge-format";
import { cleanBusinessRules } from "@/lib/agent-business-rules";
import { compileCaraOwnerPreview } from "@/lib/compile-cara-owner-preview";
import type { CaraOwnerPreview } from "@/lib/compile-cara-owner-preview";
import { weekScheduleHasOpenDay } from "@/lib/business-hours";
import {
  buildCallHandlingConflictWarnings,
  type CallHandlingConflictWarning,
} from "@/lib/call-handling-boundary";
import { dedupeCaraSetupChips } from "@/lib/cara-setup-chips";
import {
  buildServiceConflictWarnings,
  dedupeServiceChips,
  type ServiceConflictWarning,
} from "@/lib/services-boundary";
import {
  defaultVoiceGreetingIntro,
  parseGreetingParts,
  resolveVoiceGreetingPreview,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "@/lib/voice-greeting";

import { saveAgentSetup } from "../agent-setup/actions";
import type { AgentFaq } from "../agent-setup/agent-faqs";
import type { AgentSetupInitial } from "../agent-setup/agent-setup-helpers";
import type { BusinessFileListItem } from "@/lib/business-files";
import type { WeekSchedule } from "@/lib/business-hours";
import type { CaraSetupPromptInput } from "@/lib/compile-cara-prompt";

type FormSnapshot = {
  assistantDisplayName: string;
  greetingIntro: string;
  greetingClosing: string;
  businessType: string;
  openingHoursSchedule: WeekSchedule;
  openingHoursLegacy: string;
  hoursNeverConfigured: boolean;
  open24_7: boolean;
  hoursNote: string;
  serviceAreaItems: string[];
  serviceAreaExclusionItems: string[];
  servicesItems: string[];
  servicesNotOfferedItems: string[];
  detailsToCollectItems: string[];
  businessRulesItems: string[];
  faqs: AgentFaq[];
  locationAddress: string;
  locationEircode: string;
};

type CaraSetupFormContextValue = {
  businessName: string;
  businessFiles: BusinessFileListItem[];
  setBusinessFiles: (files: BusinessFileListItem[]) => void;
  assistantDisplayName: string;
  setAssistantDisplayName: (v: string) => void;
  greetingIntro: string;
  setGreetingIntro: (v: string) => void;
  greetingClosing: string;
  setGreetingClosing: (v: string) => void;
  businessType: string;
  setBusinessType: (v: string) => void;
  locationAddress: string;
  setLocationAddress: (v: string) => void;
  locationEircode: string;
  setLocationEircode: (v: string) => void;
  openingHoursSchedule: WeekSchedule;
  setOpeningHoursSchedule: (v: WeekSchedule) => void;
  openingHoursLegacy: string;
  hoursNeverConfigured: boolean;
  open24_7: boolean;
  setOpen24_7: (v: boolean) => void;
  hoursNote: string;
  setHoursNote: (v: string) => void;
  serviceAreaItems: string[];
  setServiceAreaItems: (v: string[]) => void;
  serviceAreaExclusionItems: string[];
  setServiceAreaExclusionItems: (v: string[]) => void;
  servicesItems: string[];
  setServicesItems: (v: string[]) => void;
  servicesNotOfferedItems: string[];
  setServicesNotOfferedItems: (v: string[]) => void;
  detailsToCollectItems: string[];
  setDetailsToCollectItems: (v: string[]) => void;
  businessRulesItems: string[];
  setBusinessRulesItems: (v: string[]) => void;
  faqs: AgentFaq[];
  setFaqs: (v: AgentFaq[]) => void;
  isDirty: boolean;
  pending: boolean;
  status: { kind: "ok" | "error"; message: string } | null;
  save: () => void;
  saveAsync: () => Promise<boolean>;
  compiledPromptPreview: CaraOwnerPreview;
  markSavedBaseline: () => void;
  discardChanges: () => void;
  serviceConflictWarnings: ServiceConflictWarning[];
  callHandlingConflictWarnings: CallHandlingConflictWarning[];
  promptExtras: Pick<
    CaraSetupPromptInput,
    "routes" | "fallbackNote" | "transferNumber"
  >;
};

const CaraSetupFormContext = createContext<CaraSetupFormContextValue | null>(
  null,
);

function snapshotFromState(
  state: FormSnapshot,
  openingHoursLegacy: string,
): string {
  return JSON.stringify({ ...state, openingHoursLegacy });
}

export function CaraSetupFormProvider({
  initial,
  businessFiles,
  promptExtras,
  children,
}: {
  initial: AgentSetupInitial;
  businessFiles: BusinessFileListItem[];
  promptExtras: Pick<
    CaraSetupPromptInput,
    "routes" | "fallbackNote" | "transferNumber"
  >;
  children: ReactNode;
}) {
  const defaultIntro = defaultVoiceGreetingIntro(initial.businessName);
  const parsedGreeting = parseGreetingParts(
    initial.greeting,
    initial.assistantDisplayName,
    defaultIntro,
  );
  const [assistantDisplayName, setAssistantDisplayName] = useState(
    initial.assistantDisplayName,
  );
  const [greetingIntro, setGreetingIntro] = useState(parsedGreeting.intro);
  const [greetingClosing, setGreetingClosing] = useState(parsedGreeting.closing);
  const [businessType, setBusinessType] = useState(initial.businessType);
  const [locationAddress, setLocationAddress] = useState(
    initial.locationAddress,
  );
  const [locationEircode, setLocationEircode] = useState(
    initial.locationEircode,
  );
  const [openingHoursSchedule, setOpeningHoursSchedule] = useState(
    initial.openingHoursSchedule,
  );
  const [openingHoursLegacy, setOpeningHoursLegacy] = useState(
    initial.openingHoursLegacy ?? "",
  );
  const [hoursNeverConfigured, setHoursNeverConfigured] = useState(
    initial.hoursNeverConfigured,
  );
  const [open24_7, setOpen24_7] = useState(initial.open24_7);
  const [hoursNote, setHoursNote] = useState(initial.hoursNote);
  const [serviceAreaItems, setServiceAreaItems] = useState(
    initial.serviceAreaItems,
  );
  const [serviceAreaExclusionItems, setServiceAreaExclusionItems] = useState(
    initial.serviceAreaExclusionItems,
  );
  const [servicesItems, setServicesItems] = useState(initial.servicesItems);
  const [servicesNotOfferedItems, setServicesNotOfferedItems] = useState(
    initial.servicesNotOfferedItems,
  );
  const [detailsToCollectItems, setDetailsToCollectItems] = useState(
    initial.detailsToCollectItems,
  );
  const [businessRulesItems, setBusinessRulesItems] = useState(
    initial.businessRules,
  );
  const [faqs, setFaqs] = useState<AgentFaq[]>(initial.faqs);
  const [businessFilesState, setBusinessFiles] = useState(businessFiles);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    { kind: "ok" | "error"; message: string } | null
  >(null);
  const [serviceConflictWarnings, setServiceConflictWarnings] = useState<
    ServiceConflictWarning[]
  >([]);
  const baselineRef = useRef(
    snapshotFromState(
      {
        assistantDisplayName: initial.assistantDisplayName,
        greetingIntro: parsedGreeting.intro,
        greetingClosing: parsedGreeting.closing,
        businessType: initial.businessType,
        openingHoursSchedule: initial.openingHoursSchedule,
        openingHoursLegacy: initial.openingHoursLegacy ?? "",
        hoursNeverConfigured: initial.hoursNeverConfigured,
        open24_7: initial.open24_7,
        hoursNote: initial.hoursNote,
        serviceAreaItems: initial.serviceAreaItems,
        serviceAreaExclusionItems: initial.serviceAreaExclusionItems,
        servicesItems: initial.servicesItems,
        servicesNotOfferedItems: initial.servicesNotOfferedItems,
        detailsToCollectItems: initial.detailsToCollectItems,
        businessRulesItems: initial.businessRules,
        faqs: initial.faqs,
        locationAddress: initial.locationAddress,
        locationEircode: initial.locationEircode,
      },
      initial.openingHoursLegacy ?? "",
    ),
  );

  useEffect(() => {
    setBusinessFiles(businessFiles);
  }, [businessFiles]);

  const initialSig = useMemo(
    () =>
      JSON.stringify({
        assistantDisplayName: initial.assistantDisplayName,
        greetingIntro: parsedGreeting.intro,
        greetingClosing: parsedGreeting.closing,
        businessType: initial.businessType,
        openingHoursSchedule: initial.openingHoursSchedule,
        openingHoursLegacy: initial.openingHoursLegacy,
        hoursNeverConfigured: initial.hoursNeverConfigured,
        open24_7: initial.open24_7,
        hoursNote: initial.hoursNote,
        serviceAreaItems: initial.serviceAreaItems,
        serviceAreaExclusionItems: initial.serviceAreaExclusionItems,
        servicesItems: initial.servicesItems,
        servicesNotOfferedItems: initial.servicesNotOfferedItems,
        detailsToCollectItems: initial.detailsToCollectItems,
        businessRulesItems: initial.businessRules,
        faqs: initial.faqs,
        locationAddress: initial.locationAddress,
        locationEircode: initial.locationEircode,
      }),
    [initial],
  );

  // Chat-to-Cara saves server-side; merge into form without clobbering dirty fields.
  useEffect(() => {
    const currentSnap = snapshotFromState(
      {
        assistantDisplayName,
        greetingIntro,
        greetingClosing,
        businessType,
        openingHoursSchedule,
        openingHoursLegacy,
        hoursNeverConfigured,
        open24_7,
        hoursNote,
        serviceAreaItems,
        serviceAreaExclusionItems,
        servicesItems,
        servicesNotOfferedItems,
        detailsToCollectItems,
        businessRulesItems,
        faqs,
        locationAddress,
        locationEircode,
      },
      openingHoursLegacy,
    );
    const isDirtyNow = currentSnap !== baselineRef.current;

    if (isDirtyNow) return;

    const nextParsed = parseGreetingParts(
      initial.greeting,
      initial.assistantDisplayName,
      defaultVoiceGreetingIntro(initial.businessName),
    );
    setAssistantDisplayName(initial.assistantDisplayName);
    setGreetingIntro(nextParsed.intro);
    setGreetingClosing(nextParsed.closing);
    setBusinessType(initial.businessType);
    setLocationAddress(initial.locationAddress);
    setLocationEircode(initial.locationEircode);
    setOpeningHoursSchedule(initial.openingHoursSchedule);
    setOpeningHoursLegacy(initial.openingHoursLegacy ?? "");
    setHoursNeverConfigured(initial.hoursNeverConfigured);
    setOpen24_7(initial.open24_7);
    setHoursNote(initial.hoursNote);
    setServiceAreaItems(initial.serviceAreaItems);
    setServiceAreaExclusionItems(initial.serviceAreaExclusionItems);
    setServicesItems(initial.servicesItems);
    setServicesNotOfferedItems(initial.servicesNotOfferedItems);
    setDetailsToCollectItems(initial.detailsToCollectItems);
    setBusinessRulesItems(initial.businessRules);
    setFaqs(initial.faqs);
    baselineRef.current = snapshotFromState(
      {
        assistantDisplayName: initial.assistantDisplayName,
        greetingIntro: nextParsed.intro,
        greetingClosing: nextParsed.closing,
        businessType: initial.businessType,
        openingHoursSchedule: initial.openingHoursSchedule,
        openingHoursLegacy: initial.openingHoursLegacy ?? "",
        hoursNeverConfigured: initial.hoursNeverConfigured,
        open24_7: initial.open24_7,
        hoursNote: initial.hoursNote,
        serviceAreaItems: initial.serviceAreaItems,
        serviceAreaExclusionItems: initial.serviceAreaExclusionItems,
        servicesItems: initial.servicesItems,
        servicesNotOfferedItems: initial.servicesNotOfferedItems,
        detailsToCollectItems: initial.detailsToCollectItems,
        businessRulesItems: initial.businessRules,
        faqs: initial.faqs,
        locationAddress: initial.locationAddress,
        locationEircode: initial.locationEircode,
      },
      initial.openingHoursLegacy ?? "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSig]);

  const currentSnapshot = snapshotFromState(
    {
      assistantDisplayName,
      greetingIntro,
      greetingClosing,
      businessType,
      openingHoursSchedule,
      openingHoursLegacy,
      hoursNeverConfigured,
      open24_7,
      hoursNote,
      serviceAreaItems,
      serviceAreaExclusionItems,
      servicesItems,
      servicesNotOfferedItems,
      detailsToCollectItems,
      businessRulesItems,
      faqs,
      locationAddress,
      locationEircode,
    },
    openingHoursLegacy,
  );

  const isDirty = currentSnapshot !== baselineRef.current;

  const markSavedBaseline = useCallback(() => {
    baselineRef.current = currentSnapshot;
  }, [currentSnapshot]);

  const discardChanges = useCallback(() => {
    const base = JSON.parse(baselineRef.current) as FormSnapshot & {
      openingHoursLegacy: string;
    };
    setAssistantDisplayName(base.assistantDisplayName);
    setGreetingIntro(base.greetingIntro);
    setGreetingClosing(base.greetingClosing);
    setBusinessType(base.businessType);
    setOpeningHoursSchedule(base.openingHoursSchedule);
    setOpeningHoursLegacy(base.openingHoursLegacy);
    setHoursNeverConfigured(base.hoursNeverConfigured);
    setOpen24_7(base.open24_7);
    setHoursNote(base.hoursNote);
    setServiceAreaItems(base.serviceAreaItems);
    setServiceAreaExclusionItems(base.serviceAreaExclusionItems);
    setServicesItems(base.servicesItems);
    setServicesNotOfferedItems(base.servicesNotOfferedItems);
    setDetailsToCollectItems(base.detailsToCollectItems);
    setBusinessRulesItems(base.businessRulesItems);
    setFaqs(base.faqs);
    setLocationAddress(base.locationAddress);
    setLocationEircode(base.locationEircode);
  }, []);

  const buildSavePayload = useCallback(() => {
    const hasHours = weekScheduleHasOpenDay(openingHoursSchedule);
    return {
      assistantDisplayName: VOICE_ASSISTANT_DEFAULT_NAME,
      greetingIntro,
      greetingClosing,
      faqs,
      openingHours: open24_7
        ? "Open 24 hours, 7 days a week"
        : hasHours
          ? formatWeekScheduleForAgent(openingHoursSchedule)
          : "Closed all week",
      businessHours: openingHoursSchedule,
      open24_7,
      hoursNote,
      serviceArea: formatAgentKnowledgeList(serviceAreaItems),
      serviceAreaExclusions: formatAgentKnowledgeList(serviceAreaExclusionItems),
      servicesDepartments: formatAgentKnowledgeList(
        dedupeServiceChips(servicesItems),
      ),
      servicesNotOffered: formatAgentKnowledgeList(
        dedupeServiceChips(servicesNotOfferedItems),
      ),
      detailsToCollect: formatAgentKnowledgeList(
        dedupeCaraSetupChips(detailsToCollectItems),
      ),
      businessRules: cleanBusinessRules(businessRulesItems),
      locationAddress,
      locationEircode,
    };
  }, [
    assistantDisplayName,
    greetingIntro,
    greetingClosing,
    businessType,
    faqs,
    openingHoursSchedule,
    openingHoursLegacy,
    open24_7,
    hoursNote,
    serviceAreaItems,
    serviceAreaExclusionItems,
    servicesItems,
    servicesNotOfferedItems,
    detailsToCollectItems,
    businessRulesItems,
    locationAddress,
    locationEircode,
  ]);

  const saveAsync = useCallback(async (): Promise<boolean> => {
    setStatus(null);
    const res = await saveAgentSetup(buildSavePayload());
    if (res.ok) {
      baselineRef.current = currentSnapshot;
      setHoursNeverConfigured(false);
      setServiceConflictWarnings(
        buildServiceConflictWarnings(servicesNotOfferedItems, faqs, ""),
      );
      setStatus({ kind: "ok", message: "Changes saved." });
      return true;
    }
    setStatus({ kind: "error", message: res.message });
    return false;
  }, [
    buildSavePayload,
    currentSnapshot,
    servicesNotOfferedItems,
    faqs,
    businessRulesItems,
    detailsToCollectItems,
    businessFilesState,
    promptExtras,
  ]);

  const callHandlingConflictWarnings = useMemo(
    () =>
      buildCallHandlingConflictWarnings({
        businessRules: businessRulesItems,
        detailsToCollect: detailsToCollectItems,
        faqs,
        businessFiles: businessFilesState,
        routes: promptExtras.routes,
        transferNumber: promptExtras.transferNumber,
      }),
    [
      businessRulesItems,
      detailsToCollectItems,
      faqs,
      businessFilesState,
      promptExtras,
    ],
  );

  const save = useCallback(() => {
    startTransition(async () => {
      await saveAsync();
    });
  }, [saveAsync]);
  const compiledPromptPreview = useMemo(() => {
    const hasHours = weekScheduleHasOpenDay(openingHoursSchedule);
    return compileCaraOwnerPreview({
      businessName: initial.businessName,
      assistantDisplayName: VOICE_ASSISTANT_DEFAULT_NAME,
      businessType,
      locationAddress,
      locationEircode,
      greeting: resolveVoiceGreetingPreview(
        greetingIntro,
        VOICE_ASSISTANT_DEFAULT_NAME,
        greetingClosing,
      ),
      hoursNeverConfigured,
      open24_7,
      hoursNote: hoursNote.trim() || undefined,
      openingHoursSchedule,
      openingHours: open24_7
        ? "Open 24 hours, 7 days a week"
        : hasHours
          ? formatWeekScheduleForAgent(openingHoursSchedule)
          : hoursNeverConfigured
            ? undefined
            : "Closed all week",
      serviceArea: formatAgentKnowledgeList(serviceAreaItems) || undefined,
      serviceAreaExclusions:
        formatAgentKnowledgeList(serviceAreaExclusionItems) || undefined,
      servicesOffered: formatAgentKnowledgeList(servicesItems) || undefined,
      servicesNotOffered:
        formatAgentKnowledgeList(servicesNotOfferedItems) || undefined,
      detailsToCollect:
        formatAgentKnowledgeList(detailsToCollectItems) || undefined,
      businessRules: cleanBusinessRules(businessRulesItems),
      faqs,
      routes: promptExtras.routes,
      fallbackNote: promptExtras.fallbackNote,
      transferNumber: promptExtras.transferNumber,
      businessFiles: businessFilesState,
    });
  }, [
    promptExtras,
    businessFilesState,
    initial.businessName,
    assistantDisplayName,
    businessType,
    locationAddress,
    locationEircode,
    greetingIntro,
    greetingClosing,
    hoursNeverConfigured,
    open24_7,
    hoursNote,
    openingHoursSchedule,
    openingHoursLegacy,
    serviceAreaItems,
    serviceAreaExclusionItems,
    servicesItems,
    servicesNotOfferedItems,
    detailsToCollectItems,
    businessRulesItems,
    faqs,
  ]);

  const value: CaraSetupFormContextValue = {
    businessName: initial.businessName,
    businessFiles: businessFilesState,
    setBusinessFiles,
    assistantDisplayName,
    setAssistantDisplayName,
    greetingIntro,
    setGreetingIntro,
    greetingClosing,
    setGreetingClosing,
    businessType,
    setBusinessType,
    locationAddress,
    setLocationAddress,
    locationEircode,
    setLocationEircode,
    openingHoursSchedule,
    setOpeningHoursSchedule,
    openingHoursLegacy,
    hoursNeverConfigured,
    open24_7,
    setOpen24_7,
    hoursNote,
    setHoursNote,
    serviceAreaItems,
    setServiceAreaItems,
    serviceAreaExclusionItems,
    setServiceAreaExclusionItems,
    servicesItems,
    setServicesItems,
    servicesNotOfferedItems,
    setServicesNotOfferedItems,
    detailsToCollectItems,
    setDetailsToCollectItems,
    businessRulesItems,
    setBusinessRulesItems,
    faqs,
    setFaqs,
    isDirty,
    pending,
    status,
    save,
    saveAsync,
    compiledPromptPreview,
    markSavedBaseline,
    discardChanges,
    serviceConflictWarnings,
    callHandlingConflictWarnings,
    promptExtras,
  };

  return (
    <CaraSetupFormContext.Provider value={value}>
      {children}
    </CaraSetupFormContext.Provider>
  );
}

export function useCaraSetupForm(): CaraSetupFormContextValue {
  const ctx = useContext(CaraSetupFormContext);
  if (!ctx) {
    throw new Error("useCaraSetupForm must be used within CaraSetupFormProvider");
  }
  return ctx;
}
