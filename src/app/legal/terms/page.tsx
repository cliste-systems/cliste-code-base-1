import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of service — Cliste",
  description: "Terms governing salon use of the Cliste platform.",
};

const LAST_UPDATED = "18 April 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p className="text-sm text-gray-500">
        Last updated: <strong>{LAST_UPDATED}</strong>
      </p>

      <p>
        These terms (&ldquo;Terms&rdquo;) govern your salon&rsquo;s use of the Cliste
        platform operated by <strong>Cliste Systems</strong>, registered in Ireland.
        By creating an account you agree to them.
      </p>

      <h2>1. The service</h2>
      <p>
        Cliste provides a SaaS platform for salons that includes an online booking
        storefront, a dashboard, an AI voice agent, SMS / email notifications, and
        Stripe-based payments. We reserve the right to add or remove features as the
        product evolves.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must provide accurate signup details and keep them current.</li>
        <li>
          You are responsible for everything done under your account, including by
          your team members. Treat dashboard credentials as confidential.
        </li>
        <li>
          You must be at least 18 and have the authority to bind your salon to these
          Terms.
        </li>
      </ul>

      <h2>3. Plans and fees</h2>
      <p>
        Subscription fees, per-call usage, set-up fees and the booking platform fee
        are shown on the pricing page at signup. We invoice via Stripe Billing.
        Failed payments may result in suspension after notice. You can cancel at any
        time from the dashboard; cancellation takes effect at the end of the current
        billing period.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the platform for any unlawful, deceptive or abusive purpose.</li>
        <li>
          Attempt to break, probe, reverse-engineer or interfere with the
          platform&rsquo;s security (good-faith research is welcome — see{" "}
          <a href="/SECURITY.md">SECURITY.md</a>).
        </li>
        <li>
          Send unsolicited marketing SMS or email to your customers using Cliste.
          Transactional booking confirmations and reminders are fine; bulk marketing
          is not.
        </li>
        <li>
          Process payment cards outside of the integrated Stripe flow we provide.
        </li>
      </ul>

      <h2>5. Customer data</h2>
      <p>
        You are the data controller for your customers&rsquo; personal data. Cliste
        processes that data on your behalf as your processor — see our{" "}
        <Link href="/legal/privacy">privacy notice</Link> and{" "}
        <Link href="/legal/sub-processors">sub-processors</Link>. By using Cliste you
        accept the Data Processing Agreement included in the privacy notice.
      </p>

      <h2>6. AI voice agent</h2>
      <p>
        The AI voice agent answers calls on your behalf and may suggest, create, or
        cancel bookings. You remain responsible for the appointments it agrees to.
        Where required, the agent will identify itself as an AI to callers (see EU AI
        Act disclosure in the privacy notice).
      </p>

      <h2>7. Service levels</h2>
      <p>
        We aim for high availability but do not currently offer a contractual SLA.
        Maintenance windows are scheduled outside Irish working hours where possible.
        We will use commercially reasonable efforts to restore service after
        unexpected outages. We are not liable for outages caused by sub-processors
        (Stripe, Twilio, LiveKit, OpenAI, ElevenLabs, Deepgram, Supabase,
        Cloudflare).
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        Cliste owns all intellectual property in the platform, including the
        dashboard, voice agent prompts, internal models and infrastructure code. You
        own your salon data; you grant us the rights necessary to operate the
        platform for you.
      </p>

      <h2>9. Liability</h2>
      <p>
        To the extent permitted by Irish law, Cliste&rsquo;s aggregate liability under
        these Terms in any 12-month period is capped at the fees you paid in that
        period. We exclude liability for indirect or consequential loss, lost
        profits, or lost data beyond what is required by law. Nothing in these Terms
        excludes liability we cannot exclude (e.g. for fraud, death or personal
        injury caused by negligence).
      </p>

      <h2>10. Suspension and termination</h2>
      <p>
        We may suspend or terminate accounts for material breach of these Terms,
        non-payment, or activity that puts the platform or other customers at risk.
        On termination we delete or return your salon data within 90 days, subject
        to legal retention requirements.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update these Terms. Material changes will be notified by email and a
        dashboard banner at least 30 days in advance. Continued use after the
        effective date constitutes acceptance.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws of Ireland. The courts of Ireland have
        exclusive jurisdiction over any dispute, save that we may seek injunctive
        relief in any court with jurisdiction.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms: <strong>hello@clistesystems.ie</strong>.
      </p>
    </>
  );
}
