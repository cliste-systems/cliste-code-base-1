"use client";

import { useActionState } from "react";

import {
  LegalAcceptanceCheckbox,
  LegalDocLink,
} from "@/components/legal/legal-acceptance-checkbox";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import {
  LEGAL_DOCUMENT_LABELS,
  LEGAL_DOCUMENT_PATHS,
  type LegalDocumentType,
} from "@/lib/legal-documents";

import {
  acceptOnboardingLegalDocuments,
  type AcceptOnboardingLegalResult,
} from "./actions";

const INITIAL: AcceptOnboardingLegalResult = { ok: false, message: "" };

const COPY: Record<
  LegalDocumentType,
  (label: string, link: React.ReactNode) => React.ReactNode
> = {
  terms: (label, link) => (
    <>
      I agree to the {link} ({label}).
    </>
  ),
  privacy: (label, link) => (
    <>
      I have read the {link} ({label}).
    </>
  ),
  dpa: (label, link) => (
    <>
      I accept the {link} ({label}).
    </>
  ),
};

export function OnboardingLegalAcceptForm({
  missing,
}: {
  missing: LegalDocumentType[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: AcceptOnboardingLegalResult, formData: FormData) =>
      acceptOnboardingLegalDocuments(_prev, formData),
    INITIAL,
  );

  const errorMessage = !state.ok && state.message ? state.message : null;

  return (
    <form action={formAction} className="flex w-full max-w-lg flex-col gap-4">
      {missing.map((doc) => {
        const label = LEGAL_DOCUMENT_LABELS[doc];
        const href = LEGAL_DOCUMENT_PATHS[doc];
        const link = <LegalDocLink href={href}>{label}</LegalDocLink>;
        return (
          <LegalAcceptanceCheckbox
            key={doc}
            id={`accept_${doc}`}
            name={`accept_${doc}`}
          >
            {COPY[doc](label, link)}
          </LegalAcceptanceCheckbox>
        );
      })}

      {errorMessage ? (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <OnboardingPrimaryButton
        type="submit"
        pending={pending}
        className="w-full max-w-none"
      >
        {pending ? "Saving…" : "Accept and continue setup"}
      </OnboardingPrimaryButton>
    </form>
  );
}
