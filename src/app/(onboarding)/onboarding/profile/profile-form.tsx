"use client";

import {
  useActionState,
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
import { OnboardingSelect } from "@/components/onboarding/onboarding-select";
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

const VERTICAL_OPTIONS = VERTICAL_CHOICES.map((choice) => ({
  value: choice.id,
  label: choice.label,
  description:
    choice.id === "salon_beauty"
      ? "Tailored Cara setup for salons and beauty studios"
      : "General setup for any other local business",
  examples: choice.examples,
}));

const INITIAL: SaveProfileResult = { ok: false, message: "" };

type FieldKey = "firstName" | "lastName" | "vertical" | "address" | "eircode";
type FieldErrors = Partial<Record<FieldKey, string>>;

type Props = {
  businessName: string;
  needsOwnerName: boolean;
  defaultFirstName: string;
  defaultLastName: string;
  vertical: VerticalId | "";
  onVerticalChange: (vertical: VerticalId | "") => void;
  defaultAddress: string;
  defaultEircode: string;
};

function readProfilePayload(
  form: HTMLFormElement,
  vertical: VerticalId | "",
): SaveProfilePayload {
  const data = new FormData(form);
  return {
    address: String(data.get("address") ?? ""),
    eircode: String(data.get("eircode") ?? ""),
    firstName: String(data.get("firstName") ?? ""),
    lastName: String(data.get("lastName") ?? ""),
    vertical: vertical || String(data.get("vertical") ?? ""),
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

  return errors;
}

export function ProfileForm(props: Props) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [state, formAction, pending] = useActionState(saveProfileStep, INITIAL);

  const [address, setAddress] = useState(props.defaultAddress);
  const [eircode, setEircode] = useState(props.defaultEircode);

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [importing, startImport] = useTransition();
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const formLevelError = !state.ok && state.message ? state.message : null;

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
      if (result.address) setAddress(result.address);
      if (result.eircode) setEircode(result.eircode);

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
          ? `Imported ${formatList(bits)} from your site — review them on the next steps.`
          : "Imported details from your site — you can add more on the next steps.",
      );
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = readProfilePayload(event.currentTarget, props.vertical);
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
