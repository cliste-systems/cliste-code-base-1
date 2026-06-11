
import {
    LegalList,
  LegalPageHeader,
  LegalSection,
} from "@/components/legal/legal-document";
import { LegalInlineLink } from "@/components/legal/legal-path-context";


export function DpaDocument() {
  return (
    <>
      <LegalPageHeader
        title="Data Processing Agreement (DPA)"
        description="Applies when Cliste processes personal data on your behalf under the GDPR. You remain the controller for your callers and contacts."
      />

      <p className="text-[15px] leading-relaxed text-slate-700">
        The full legal text is maintained in{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          docs/legal/DPA.md
        </code>
        . This page is the customer-facing summary. For a countersigned copy
        before your first paid subscription, email{" "}
        <a
          href="mailto:privacy@clistesystems.ie"
          className="font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          privacy@clistesystems.ie
        </a>
        .
      </p>

      <LegalSection title="1. What we process and why">
        <p>
          Cliste processes caller contact details, call metadata, redacted
          transcripts, AI summaries, Action Inbox items, and related optional
          appointment data solely to operate your AI receptionist, dashboard, and
          notifications you configure.
        </p>
      </LegalSection>

      <LegalSection title="2. Your obligations as controller">
        <LegalList>
          <li>You have a lawful basis under Article 6 GDPR for data you share with Cliste.</li>
          <li>
            You inform callers that calls may be handled by an AI and may be
            recorded/transcribed, as required for your sector.
          </li>
          <li>
            You use{" "}
            <LegalInlineLink href="/dashboard/legal/data-requests">
              Data request tools
            </LegalInlineLink>{" "}
            in the dashboard to respond to access and erasure requests.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Our obligations as processor">
        <LegalList>
          <li>We process only on your documented instructions.</li>
          <li>We implement appropriate security (encryption, access controls, logging).</li>
          <li>We assist with data-subject requests using your dashboard tools.</li>
          <li>
            We notify you without undue delay (within 72 hours where feasible) of
            breaches affecting your data.
          </li>
          <li>
            At termination we delete or return data per our{" "}
            <LegalInlineLink href="/legal/privacy#retention">
              retention schedule
            </LegalInlineLink>
            , except where law requires longer storage.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. Sub-processors">
        <p>
          Listed at{" "}
          <LegalInlineLink href="/legal/sub-processors">
            /legal/sub-processors
          </LegalInlineLink>
          . We notify you before adding material sub-processors where required.
        </p>
      </LegalSection>

      <LegalSection title="5. International transfers">
        <p>
          Primary application data is hosted in the EU where configured. Outside
          the EEA we use DPF certification and/or SCCs as described on the
          sub-processor page.
        </p>
      </LegalSection>

      <LegalSection title="6. Retention">
        <p>
          Automatic retention is described in the{" "}
          <LegalInlineLink href="/legal/privacy#retention">privacy notice</LegalInlineLink>{" "}
          (e.g. transcripts cleared after 30 days).
        </p>
      </LegalSection>

      <LegalSection title="7. Related documents">
        <LegalList>
          <li>
            <LegalInlineLink href="/legal/terms">Terms of service</LegalInlineLink>
          </li>
          <li>
            <LegalInlineLink href="/legal/privacy">Privacy notice</LegalInlineLink>
          </li>
          <li>
            <LegalInlineLink href="/legal/cookies">Cookies</LegalInlineLink>
          </li>
        </LegalList>
      </LegalSection>
    </>
  );
}
