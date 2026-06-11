import {
  LegalPageHeader,
  LegalSection,
  LegalTable,
} from "@/components/legal/legal-document";
import { LegalInlineLink } from "@/components/legal/legal-path-context";
import {
  SUB_PROCESSOR_CATEGORIES_PUBLIC,
  SUB_PROCESSOR_GROUP_LABELS,
  SUB_PROCESSORS,
  type SubProcessorGroup,
} from "@/lib/sub-processors.data";

type SubProcessorsDocumentProps = {
  /** Public site: categories only. Dashboard: full named annex for business customers. */
  variant?: "public" | "customer";
};

const GROUP_ORDER: SubProcessorGroup[] = [
  "eea-hosting",
  "us-voice",
  "global-services",
];

export function SubProcessorsDocument({
  variant = "public",
}: SubProcessorsDocumentProps) {
  const isCustomer = variant === "customer";

  return (
    <>
      <LegalPageHeader
        title="Sub-processors"
        description={
          isCustomer
            ? "Named third parties we use to deliver Cliste. This annex forms part of our DPA with your business."
            : "How Cliste uses third parties to run the platform. Categories below; business customers receive the named list in their dashboard."
        }
      />

      <LegalSection title="Where your data lives">
        <p>
          <strong>Primary business and caller data</strong> (database records,
          transcripts, contacts, action-inbox items) is stored in the{" "}
          <strong>EEA</strong> — Supabase on AWS <strong>eu-west-1 (Ireland)</strong>.
          The dashboard and voice worker run on <strong>EU-region hosting</strong>{" "}
          (Vercel and Railway).
        </p>
        <p>
          The <strong>voice AI stack</strong> (real-time telephony, speech-to-text,
          text-to-speech, LLM) is largely US-based. There are no practical EU-only
          equivalents for this stack today. We rely on{" "}
          <strong>EU–US Data Privacy Framework</strong> certification and/or{" "}
          <strong>Standard Contractual Clauses</strong>, plus technical measures:
          TLS, no voice-audio retention, and transcript redaction. This is standard
          for AI voice products and is documented in our DPA.
        </p>
      </LegalSection>

      <LegalSection title="What we publish (and what we do not)">
        <p>
          Under GDPR Article 28, <strong>business customers</strong> (data
          controllers) must receive the <strong>names</strong> of our
          sub-processors — not just categories. That named annex is in your{" "}
          <LegalInlineLink href="/dashboard/legal/sub-processors">
            dashboard Legal &amp; privacy
          </LegalInlineLink>{" "}
          area and in the{" "}
          <LegalInlineLink href="/legal/dpa">Data Processing Agreement</LegalInlineLink>.
        </p>
        <p>
          For <strong>callers</strong>, your privacy notice should describe{" "}
          <em>categories</em> of recipients (hosting, AI speech services, SMS) —
          you do not need to list vendor product names on your shop window.
        </p>
        <p>
          We do <strong>not</strong> publish proprietary architecture, integration
          details, or model routing — those are trade secrets. Competitors cannot
          lawfully avoid naming their own sub-processors in customer contracts
          either; the public category summary here is for transparency, not a
          build sheet.
        </p>
      </LegalSection>

      {!isCustomer ? (
        <>
          <LegalSection title="Categories of sub-processors (public summary)">
            <LegalTable
              headers={["Category", "Purpose", "Location", "Transfers"]}
              rows={SUB_PROCESSOR_CATEGORIES_PUBLIC.map((row) => [
                row.category,
                row.purpose,
                row.location,
                row.transfers,
              ])}
            />
            <p className="text-[12px] text-slate-500">
              Signed-in business customers: open{" "}
              <LegalInlineLink href="/dashboard/legal/sub-processors">
                Legal &amp; privacy → Sub-processors
              </LegalInlineLink>{" "}
              for the current named vendor list, or email{" "}
              <strong>privacy@clistesystems.ie</strong>.
            </p>
          </LegalSection>
        </>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-slate-700">
            We give business customers at least 30 days&rsquo; notice of material
            changes (new vendor or region) by email where required. You may object
            on legitimate data-protection grounds — see the{" "}
            <LegalInlineLink href="/legal/privacy">privacy notice</LegalInlineLink>.
          </p>

          {GROUP_ORDER.map((group) => {
            const rows = SUB_PROCESSORS.filter((s) => s.group === group);
            if (rows.length === 0) return null;
            return (
              <LegalSection key={group} title={SUB_PROCESSOR_GROUP_LABELS[group]}>
                <LegalTable
                  headers={["Vendor", "Purpose", "Data", "Location", "Transfer"]}
                  rows={rows.map((s) => [
                    <LegalInlineLink key={s.name} href={s.url} external>
                      {s.name}
                    </LegalInlineLink>,
                    s.purpose,
                    s.data,
                    s.location,
                    s.transferMechanism,
                  ])}
                />
              </LegalSection>
            );
          })}
        </>
      )}

      <LegalSection title="Standard Contractual Clauses (SCCs)">
        <p>
          Where data leaves the EEA we use the European Commission&rsquo;s 2021
          SCCs, supplemented by TLS, encryption at rest, no voice-audio retention,
          and transcript redaction of card numbers and government IDs.
        </p>
      </LegalSection>

      <LegalSection title="Data Processing Agreement (DPA)">
        <p>
          Our DPA with you is at{" "}
          <LegalInlineLink href="/legal/dpa">/legal/dpa</LegalInlineLink>.
          Enterprise customers may request a countersigned copy — email{" "}
          <strong>privacy@clistesystems.ie</strong>.
        </p>
      </LegalSection>
    </>
  );
}
