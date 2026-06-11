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
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

import {
  OnboardingFieldBox,
  OnboardingFieldRow,
  OnboardingFormCard,
} from "@/components/onboarding/onboarding-form-card";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import {
  ONBOARDING_FIELD_HINT,
  ONBOARDING_FIELD_INPUT,
} from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";
import { VERTICAL_CHOICES, type VerticalId } from "@/lib/verticals";

import {
  importWebsiteForProfile,
  saveProfileStep,
  type SaveProfilePayload,
  type SaveProfileResult,
} from "../actions";

const INITIAL: SaveProfileResult = { ok: false, message: "" };

type FieldKey =
  | "firstName"
  | "lastName"
  | "vertical"
  | "businessDescription"
  | "address"
  | "eircode";
type FieldErrors = Partial<Record<FieldKey, string>>;

type Props = {
  businessName: string;
  needsOwnerName: boolean;
  defaultFirstName: string;
  defaultLastName: string;
  defaultBusinessDescription: string;
  defaultVertical: VerticalId | "";
  defaultAddress: string;
  defaultEircode: string;
};

function readProfilePayload(form: HTMLFormElement): SaveProfilePayload {
  const data = new FormData(form);
  return {
    businessDescription: String(data.get("businessDescription") ?? ""),
    address: String(data.get("address") ?? ""),
    eircode: String(data.get("eircode") ?? ""),
    firstName: String(data.get("firstName") ?? ""),
    lastName: String(data.get("lastName") ?? ""),
    vertical: String(data.get("vertical") ?? ""),
  };
}

function validateProfilePayload(
  payload: SaveProfilePayload,
  needsOwnerName: boolean,
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

  if (!payload.businessDescription.trim()) {
    errors.businessDescription = "Describe what kind of business this is";
  } else if (payload.businessDescription.trim().length < 2) {
    errors.businessDescription = "Add a bit more detail";
  }

  // Address / Eircode are validated server-side (only required for verticals
  // that have a physical location), so online-only businesses aren't blocked.

  return errors;
}

export function ProfileForm(props: Props) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [state, formAction, pending] = useActionState(saveProfileStep, INITIAL);
  const lastStateRef = useRef(state);

  const [vertical, setVertical] = useState<VerticalId | "">(
    props.defaultVertical,
  );

  // Controlled so website import can prefill them.
  const [businessDescription, setBusinessDescription] = useState(
    props.defaultBusinessDescription,
  );
  const [address, setAddress] = useState(props.defaultAddress);
  const [eircode, setEircode] = useState(props.defaultEircode);

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [importing, startImport] = useTransition();
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const serverError = !state.ok && state.message ? state.message : null;
  const formLevelError =
    serverError &&
    !fieldErrors.businessDescription &&
    !serverError.toLowerCase().includes("describe") &&
    !serverError.toLowerCase().includes("look right")
      ? serverError
      : null;

  useEffect(() => {
    if (lastStateRef.current === state) return;
    lastStateRef.current = state;

    if (!state.ok && state.message) {
      const message = state.message.toLowerCase();
      if (message.includes("describe") || message.includes("look right")) {
        // Surface the server-action error against the field it belongs to.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFieldErrors((current) => ({
          ...current,
          businessDescription: state.message!,
        }));
      }
    }
  }, [state]);

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
    setImportNotice(null);
    startImport(async () => {
      const result = await importWebsiteForProfile(url);
      if (!result.ok) {
        setImportError(result.message);
        return;
      }
      setBusinessDescription(result.businessDescription);
      if (result.address) setAddress(result.address);
      if (result.eircode) setEircode(result.eircode);
      clearFieldError("businessDescription");

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
      setImportNotice(
        bits.length
          ? `Imported your description plus ${formatList(bits)} — review them on the next steps.`
          : "Imported your description — add anything else below.",
      );
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = readProfilePayload(event.currentTarget);
    const errors = validateProfilePayload(payload, props.needsOwnerName);
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

      <input type="hidden" name="vertical" value={vertical} />
      <OnboardingFieldBox
        label="What kind of business is this?"
        error={fieldErrors.vertical}
      >
        <p className={cn(ONBOARDING_FIELD_HINT, "!mt-0")}>
          This tailors Cara and your dashboard to how you actually work.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {VERTICAL_CHOICES.map((choice) => {
            const selected = vertical === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setVertical(choice.id);
                  clearFieldError("vertical");
                }}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition",
                  selected
                    ? "border-[#0b1220] bg-[#0b1220]/[0.04] ring-1 ring-[#0b1220]"
                    : "border-slate-200 hover:border-slate-300",
                )}
              >
                <span className="text-[15px] font-semibold text-[#0b1220]">
                  {choice.label}
                </span>
                <span className="text-[12px] leading-snug text-slate-500">
                  {choice.description}
                </span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {choice.examples.map((example) => (
                    <span
                      key={example}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                    >
                      {example}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
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
            {importing ? "Reading…" : "Import"}
          </button>
        </div>
        {importNotice ? (
          <p className="mt-2 text-[12px] font-medium leading-snug text-emerald-700">
            {importNotice}
          </p>
        ) : null}
        {importError ? (
          <p className="mt-2 text-[12px] font-medium leading-snug text-amber-700">
            {importError}
          </p>
        ) : null}
      </OnboardingFieldBox>

      <OnboardingFieldBox label="Business name" className="py-2.5">
        <p className="mt-1 text-[15px] font-medium leading-snug text-[#0b1220]">
          {props.businessName}
        </p>
      </OnboardingFieldBox>

      <OnboardingFieldBox
        label="Describe it in a few words"
        htmlFor="businessDescription"
        error={fieldErrors.businessDescription}
      >
        <p className={cn(ONBOARDING_FIELD_HINT, "!mt-0")}>
          Plain English is fine — e.g. hair salon, nail bar, barber shop. Cara
          uses this to tailor your setup.
        </p>
        <input
          id="businessDescription"
          name="businessDescription"
          type="text"
          value={businessDescription}
          onChange={(e) => setBusinessDescription(e.target.value)}
          placeholder="e.g. Law firm, Plumber, Coffee shop"
          aria-invalid={Boolean(fieldErrors.businessDescription)}
          className={ONBOARDING_FIELD_INPUT}
          onInput={() => clearFieldError("businessDescription")}
        />
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
