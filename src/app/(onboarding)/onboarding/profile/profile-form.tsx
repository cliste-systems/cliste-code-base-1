"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
  useTransition,
  type FormEvent,
} from "react";
import { ArrowRight, Building2, Loader2, MessageCircle, Send, Sparkles } from "lucide-react";

import {
  OnboardingFieldBox,
  OnboardingFieldRow,
  OnboardingFormCard,
} from "@/components/onboarding/onboarding-form-card";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { OnboardingSelect } from "@/components/onboarding/onboarding-select";
import {
  ONBOARDING_FIELD_HINT,
  ONBOARDING_FIELD_INPUT,
} from "@/components/onboarding/onboarding-ui";
import { CARA_GOAL_CHOICES, type CaraGoal } from "@/lib/cara-goal";
import { isValidIrishEircode } from "@/lib/irish-eircode";
import { nicheHasPhysicalLocation } from "@/lib/organization-niche";
import { cn } from "@/lib/utils";
import type { WebsiteImportLocation } from "@/lib/website-import-types";
import {
  profileDefaultsForVertical,
  VERTICAL_CHOICES,
  VERTICAL_PACKS,
  type VerticalId,
} from "@/lib/verticals";

import {
  importWebsiteForProfile,
  saveProfileStep,
  type SaveProfilePayload,
  type SaveProfileResult,
} from "../actions";

const CARA_GOAL_OPTIONS = CARA_GOAL_CHOICES.map((choice) => ({
  value: choice.id,
  label: choice.label,
  tagline: choice.tagline,
  description: choice.description,
  icon: choice.id === "faq_only" ? MessageCircle : Send,
  iconClassName: "bg-slate-100 text-slate-600",
}));

const VERTICAL_OPTIONS = VERTICAL_CHOICES.map((choice) => {
  const pack = VERTICAL_PACKS[choice.id];
  return {
    value: choice.id,
    label: choice.label,
    tagline: choice.tagline,
    icon: pack.onboarding.pickerIcon === "sparkles" ? Sparkles : Building2,
    iconClassName: "bg-slate-100 text-slate-600",
  };
});

const INITIAL: SaveProfileResult = { ok: false, message: "" };

const WEBSITE_IMPORT_PHASES = [
  { delayMs: 0, message: "Opening your website…", target: 6 },
  { delayMs: 2_000, message: "Reading what's on your site…", target: 20 },
  { delayMs: 5_000, message: "Still going — some sites are slow to load", target: 36 },
  { delayMs: 10_000, message: "Taking a bit longer than usual…", target: 52 },
  { delayMs: 18_000, message: "Nearly done…", target: 68 },
  { delayMs: 28_000, message: "Still working on it…", target: 80 },
  { delayMs: 40_000, message: "Almost there…", target: 88 },
] as const;

function useWebsiteImportProgress() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [percent, setPercent] = useState(0);
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const rafRef = useRef(0);

  const clearTimers = () => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  const startAnimationLoop = () => {
    const tick = () => {
      const target = targetRef.current;
      const diff = target - currentRef.current;
      if (Math.abs(diff) > 0.12) {
        currentRef.current += diff * 0.07;
        setPercent(currentRef.current);
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
  };

  const start = () => {
    clearTimers();
    currentRef.current = 0;
    targetRef.current = WEBSITE_IMPORT_PHASES[0].target;
    setPercent(0);
    setMessage(WEBSITE_IMPORT_PHASES[0].message);
    setVisible(true);
    startAnimationLoop();

    for (const phase of WEBSITE_IMPORT_PHASES) {
      const timer = window.setTimeout(() => {
        targetRef.current = phase.target;
        setMessage(phase.message);
      }, phase.delayMs);
      timersRef.current.push(timer);
    }
  };

  const finish = async (ok: boolean) => {
    clearTimers();
    if (!ok) {
      setVisible(false);
      setPercent(0);
      currentRef.current = 0;
      return;
    }
    targetRef.current = 100;
    currentRef.current = 100;
    setPercent(100);
    setMessage("Done — details imported");
    await new Promise((resolve) => window.setTimeout(resolve, 550));
    setVisible(false);
    setPercent(0);
    currentRef.current = 0;
  };

  useEffect(() => () => clearTimers(), []);

  return { visible, message, percent, start, finish };
}

type FieldKey = "firstName" | "lastName" | "vertical" | "caraGoal" | "address" | "eircode";
type FieldErrors = Partial<Record<FieldKey, string>>;

type Props = {
  businessName: string;
  needsOwnerName: boolean;
  defaultFirstName: string;
  defaultLastName: string;
  vertical: VerticalId | "";
  onVerticalChange: (vertical: VerticalId | "") => void;
  caraGoal: CaraGoal | "";
  onCaraGoalChange: (goal: CaraGoal | "") => void;
  defaultAddress: string;
  defaultEircode: string;
};

function readProfilePayload(
  form: HTMLFormElement,
  vertical: VerticalId | "",
  caraGoal: CaraGoal | "",
): SaveProfilePayload {
  const data = new FormData(form);
  return {
    address: String(data.get("address") ?? ""),
    eircode: String(data.get("eircode") ?? ""),
    firstName: String(data.get("firstName") ?? ""),
    lastName: String(data.get("lastName") ?? ""),
    vertical: vertical || String(data.get("vertical") ?? ""),
    caraGoal: caraGoal || String(data.get("caraGoal") ?? ""),
  };
}

function validateProfilePayload(
  payload: SaveProfilePayload,
  needsOwnerName: boolean,
  vertical: VerticalId | "",
): FieldErrors {
  const errors: FieldErrors = {};

  if (needsOwnerName) {
    if (!payload.firstName.trim()) {
      errors.firstName = "Add your first name";
    }
    if (!payload.lastName.trim()) {
      errors.lastName = "Add your last name";
    }
  }

  if (!payload.vertical?.trim()) {
    errors.vertical = "Pick the option that fits you best";
  }

  if (!payload.caraGoal?.trim()) {
    errors.caraGoal = "Choose what you want Cara to do on calls";
  }

  const verticalId = vertical || payload.vertical?.trim();
  const parsedVertical =
    verticalId && VERTICAL_CHOICES.some((c) => c.id === verticalId)
      ? (verticalId as VerticalId)
      : null;
  const requiresLocation = parsedVertical
    ? nicheHasPhysicalLocation(profileDefaultsForVertical(parsedVertical).niche)
    : true;

  if (requiresLocation) {
    if (!payload.address.trim()) {
      errors.address = "Add your address";
    }
    if (!payload.eircode.trim()) {
      errors.eircode = "Add your Eircode";
    } else if (!isValidIrishEircode(payload.eircode)) {
      errors.eircode = "Enter one Eircode for this location";
    }
  }

  return errors;
}

export function ProfileForm(props: Props) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [state, formAction, pending] = useActionState(saveProfileStep, INITIAL);

  const [address, setAddress] = useState(props.defaultAddress);
  const [eircode, setEircode] = useState(props.defaultEircode);

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [importing, startImport] = useTransition();
  const importProgress = useWebsiteImportProgress();
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importErrorReason, setImportErrorReason] = useState<string | null>(null);
  const [importedLocations, setImportedLocations] = useState<
    WebsiteImportLocation[]
  >([]);
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(
    null,
  );

  const formLevelError = !state.ok && state.message ? state.message : null;

  function locationKey(location: WebsiteImportLocation, index: number): string {
    return location.eircode || `${location.label}|${location.address}|${index}`;
  }

  function applyImportedLocation(location: WebsiteImportLocation) {
    if (location.address) setAddress(location.address);
    if (location.eircode) setEircode(location.eircode);
    clearFieldError("address");
    clearFieldError("eircode");
  }

  function handleSelectImportedLocation(
    location: WebsiteImportLocation,
    index: number,
  ) {
    const key = locationKey(location, index);
    setSelectedLocationKey(key);
    applyImportedLocation(location);
  }

  function clearFieldError(key: FieldKey) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function handleImport() {
    const url = websiteUrl.trim();
    if (!url || importing) return;
    setImportError(null);
    setImportErrorReason(null);
    setImportNotice(null);
    setImportedLocations([]);
    setSelectedLocationKey(null);
    importProgress.start();
    startImport(async () => {
      const result = await importWebsiteForProfile(url);
      if (!result.ok) {
        setImportError(result.message);
        setImportErrorReason(result.reason ?? null);
        await importProgress.finish(false);
        return;
      }

      const multipleLocations = result.locations.length > 1;
      setImportedLocations(result.locations);

      if (multipleLocations) {
        setAddress("");
        setEircode("");
      } else {
        if (result.address) setAddress(result.address);
        if (result.eircode) setEircode(result.eircode);
      }

      if (result.regulated) {
        setImportError(
          "Heads up: medical, legal, and financial services aren't supported yet.",
        );
      }

      const bits: string[] = [];
      if (result.imported.services) bits.push("services");
      if (result.imported.hours) bits.push("hours");
      if (result.imported.area) bits.push("areas covered");
      if (result.imported.faqs) bits.push(`${result.imported.faqs} FAQs`);

      if (multipleLocations) {
        setImportNotice(
          bits.length
            ? `Imported ${formatList(bits)} — pick your main location below.`
            : "Imported details from your site — pick your main location below.",
        );
      } else {
        setImportNotice(
          bits.length
            ? `Imported ${formatList(bits)} from your site — review them on the next steps.`
            : "Imported details from your site — you can add more on the next steps.",
        );
      }
      await importProgress.finish(true);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = readProfilePayload(event.currentTarget, props.vertical, props.caraGoal);
    const errors = validateProfilePayload(payload, props.needsOwnerName, props.vertical);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    startTransition(() => {
      formAction(payload);
    });
  }

  return (
    <OnboardingFormCard
      fieldSurface="profile"
      noValidate
      onSubmit={handleSubmit}
      error={formLevelError}
      footer={
        <OnboardingPrimaryButton
          type="submit"
          pending={pending}
          className="min-w-[200px]"
        >
          {pending ? "Saving…" : "Continue"}
          {!pending ? <ArrowRight className="size-4" aria-hidden /> : null}
        </OnboardingPrimaryButton>
      }
    >
      {props.needsOwnerName ? (
        <OnboardingFieldRow className="grid gap-3 sm:grid-cols-2">
          <OnboardingFieldBox
            label="First name"
            htmlFor="firstName"
            error={fieldErrors.firstName}
          >
            <input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              defaultValue={props.defaultFirstName}
              placeholder="Jane"
              aria-invalid={Boolean(fieldErrors.firstName)}
              className={ONBOARDING_FIELD_INPUT}
              onInput={() => clearFieldError("firstName")}
            />
          </OnboardingFieldBox>
          <OnboardingFieldBox
            label="Last name"
            htmlFor="lastName"
            error={fieldErrors.lastName}
          >
            <input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              defaultValue={props.defaultLastName}
              placeholder="Smith"
              aria-invalid={Boolean(fieldErrors.lastName)}
              className={ONBOARDING_FIELD_INPUT}
              onInput={() => clearFieldError("lastName")}
            />
          </OnboardingFieldBox>
        </OnboardingFieldRow>
      ) : null}

      <input type="hidden" name="vertical" value={props.vertical} />
      <OnboardingFieldBox
        label="What kind of business is this?"
        htmlFor="vertical"
        error={fieldErrors.vertical}
      >
        <OnboardingSelect
          id="vertical"
          value={props.vertical}
          options={VERTICAL_OPTIONS}
          placeholder="Select business type"
          invalid={Boolean(fieldErrors.vertical)}
          onValueChange={(next) => {
            props.onVerticalChange(next);
            clearFieldError("vertical");
          }}
        />
      </OnboardingFieldBox>

      <input type="hidden" name="caraGoal" value={props.caraGoal} />
      <OnboardingFieldBox
        label="What should Cara do on calls?"
        htmlFor="caraGoal"
        error={fieldErrors.caraGoal}
      >
        <OnboardingSelect
          id="caraGoal"
          value={props.caraGoal}
          options={CARA_GOAL_OPTIONS}
          placeholder="Choose how Cara helps callers"
          invalid={Boolean(fieldErrors.caraGoal)}
          onValueChange={(next) => {
            props.onCaraGoalChange(next);
            clearFieldError("caraGoal");
          }}
        />
      </OnboardingFieldBox>

      <OnboardingFieldBox label="Have a website? (optional)" htmlFor="websiteUrl">
        <p className={cn(ONBOARDING_FIELD_HINT, "!mt-0")}>
          Paste your site and Cara fills in the rest — you can edit everything.
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            inputMode="url"
            autoComplete="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleImport();
              }
            }}
            placeholder="yourbusiness.ie"
            disabled={importing}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-[#0b1220] outline-none ring-0 placeholder:text-slate-400 focus-visible:ring-0"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !websiteUrl.trim()}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#0b1220] px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#0b1220]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
        {importProgress.visible ? (
          <div className="mt-2.5 space-y-2" role="status" aria-live="polite">
            <p className="flex items-center justify-between gap-2 text-[12px] leading-snug text-slate-600">
              <span className="flex min-w-0 items-center gap-2">
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#0b1220]/20" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#0b1220]/50" />
                </span>
                <span className="truncate">{importProgress.message}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[11px] text-slate-500">
                {Math.round(importProgress.percent)}%
              </span>
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-slate-200/90">
              <div
                className="h-full rounded-full bg-[#0b1220] transition-[width] duration-150 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, importProgress.percent))}%` }}
              />
            </div>
          </div>
        ) : null}
        {importNotice ? (
          <p className="mt-2 text-[12px] font-medium leading-snug text-emerald-700">
            {importNotice}
          </p>
        ) : null}
        {importError ? (
          <div className="mt-2 space-y-0.5">
            <p className="text-[12px] font-medium leading-snug text-amber-800">
              {importError}
            </p>
            {importErrorReason ? (
              <p className="text-[11px] leading-snug text-amber-700/90">
                {importErrorReason}
              </p>
            ) : null}
          </div>
        ) : null}
        {importedLocations.length > 1 ? (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200/90 bg-slate-50/70 p-3">
            <p className="text-[12px] font-medium leading-snug text-slate-800">
              We found {importedLocations.length} locations — which one are you
              setting up first?
            </p>
            <ul className="space-y-2" role="radiogroup" aria-label="Primary location">
              {importedLocations.map((location, index) => {
                const key = locationKey(location, index);
                const selected = selectedLocationKey === key;
                const title =
                  location.label ||
                  location.address.split(",")[0]?.trim() ||
                  `Location ${index + 1}`;

                return (
                  <li key={key}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition",
                        selected
                          ? "border-[#0b1220]/30 bg-white shadow-sm"
                          : "border-slate-200/90 bg-white/80 hover:border-slate-300",
                      )}
                    >
                      <input
                        type="radio"
                        name="importedLocation"
                        value={key}
                        checked={selected}
                        onChange={() => handleSelectImportedLocation(location, index)}
                        className="mt-1 size-4 shrink-0 accent-[#0b1220]"
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-[#0b1220]">
                          {title}
                        </span>
                        {location.address ? (
                          <span className="mt-0.5 block text-[12px] leading-snug text-slate-600">
                            {location.address}
                          </span>
                        ) : null}
                        {location.eircode ? (
                          <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
                            {location.eircode}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] leading-snug text-slate-500">
              You can add your other site later under Locations in the dashboard.
            </p>
          </div>
        ) : null}
      </OnboardingFieldBox>

      <OnboardingFieldBox label="Business name" className="py-2.5">
        <p className="mt-1 text-[15px] font-medium leading-snug text-[#0b1220]">
          {props.businessName}
        </p>
      </OnboardingFieldBox>

      <OnboardingFieldRow className="grid gap-3 sm:grid-cols-2">
        <OnboardingFieldBox
          label="Address"
          htmlFor="address"
          error={fieldErrors.address}
        >
          <input
            id="address"
            name="address"
            type="text"
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, town"
            aria-invalid={Boolean(fieldErrors.address)}
            className={ONBOARDING_FIELD_INPUT}
            onInput={() => clearFieldError("address")}
          />
        </OnboardingFieldBox>
        <OnboardingFieldBox
          label="Eircode"
          htmlFor="eircode"
          error={fieldErrors.eircode}
        >
          <input
            id="eircode"
            name="eircode"
            type="text"
            autoComplete="postal-code"
            value={eircode}
            onChange={(e) => setEircode(e.target.value)}
            placeholder="D06 X2P6"
            aria-invalid={Boolean(fieldErrors.eircode)}
            className={ONBOARDING_FIELD_INPUT}
            onInput={() => clearFieldError("eircode")}
          />
        </OnboardingFieldBox>
      </OnboardingFieldRow>
    </OnboardingFormCard>
  );
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
