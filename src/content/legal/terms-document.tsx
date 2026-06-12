
import {
    LegalList,
  LegalPageHeader,
  LegalSection,
} from "@/components/legal/legal-document";
import { LegalInlineLink } from "@/components/legal/legal-path-context";
import { CLISTE_COMPANY, companyRegistrationLine } from "@/lib/company-details";


export function TermsDocument() {
  return (
    <>
      <LegalPageHeader
        title="Terms of service"
        description="These terms govern your business use of the Cliste platform operated by Cliste Systems, registered in Ireland."
      />

      <p className="text-[15px] leading-relaxed text-slate-700">
        By creating an account you agree to these Terms.
      </p>

      <LegalSection title="1. The service">
        <p>
          Cliste provides a SaaS platform including an AI voice agent for inbound
          calls, a dashboard (calls, Action Inbox, contacts, routing, agent
          setup), and optional SMS/email notifications. Platform subscription
          and usage are billed via Stripe Billing. We may add or change features
          as the product evolves.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <LegalList>
          <li>You must provide accurate signup details and keep them current.</li>
          <li>
            You are responsible for activity under your account, including team
            members. Keep credentials confidential.
          </li>
          <li>
            You must be at least 18 and authorised to bind your business to
            these Terms.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Plans and fees">
        <p>
          Fees are shown at signup and in the Usage area of your dashboard. We
          invoice via Stripe. Failed payments may lead to suspension after notice.
          You may cancel from the billing portal; cancellation takes effect at
          the end of the current billing period.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p>You agree not to:</p>
        <LegalList>
          <li>Use the platform for unlawful, deceptive or abusive purposes.</li>
          <li>
            Attempt to break, probe or interfere with security (good-faith
            research is welcome where coordinated with us).
          </li>
          <li>
            Send unsolicited marketing SMS or email through Cliste. Transactional
            alerts you configure (e.g. Action Inbox) are permitted; bulk marketing
            is not.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Customer and caller data">
        <p>
          You are the data controller for your callers&rsquo; and contacts&rsquo;
          data. Cliste processes that data as processor — see our{" "}
          <LegalInlineLink href="/legal/privacy">privacy notice</LegalInlineLink>{" "}
          and <LegalInlineLink href="/legal/dpa">DPA</LegalInlineLink>.
        </p>
      </LegalSection>

      <LegalSection title="6. AI voice agent">
        <p>
          The agent answers calls on your behalf and may create action items or
          optional appointments. You remain responsible for how you follow up.
          The agent will identify itself as AI where required (see privacy
          notice).
        </p>
      </LegalSection>

      <LegalSection title="7. Service levels">
        <p>
          We aim for high availability but do not currently offer a contractual
          SLA. Maintenance is scheduled outside Irish working hours where possible.
          We are not liable for outages caused by third-party infrastructure
          (hosting, telephony, speech AI, payments, or messaging providers).
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <p>
          Cliste owns platform IP. You own your business data and grant us rights
          needed to operate the service for you.
        </p>
      </LegalSection>

      <LegalSection title="9. Liability">
        <p>
          To the extent permitted by Irish law, Cliste&rsquo;s aggregate liability
          in any 12-month period is capped at fees paid in that period. We exclude
          indirect or consequential loss except where law does not allow exclusion.
        </p>
      </LegalSection>

      <LegalSection title="10. Suspension and termination">
        <p>
          We may suspend or terminate for material breach, non-payment, or risk to
          the platform or other customers. On termination we delete or return data
          within 30 days, subject to legal retention.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          Material changes will be notified by email and/or dashboard banner at
          least 30 days in advance where practicable.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing law">
        <p>
          Irish law applies. Irish courts have exclusive jurisdiction, save that we
          may seek injunctive relief elsewhere where permitted.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>{companyRegistrationLine()}</p>
        <p>
          <strong>{CLISTE_COMPANY.helloEmail}</strong>
        </p>
      </LegalSection>
    </>
  );
}
