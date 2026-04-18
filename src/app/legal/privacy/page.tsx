import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy notice — Cliste",
  description:
    "How Cliste Systems processes salon and customer personal data, lawful bases, retention, transfers, and your rights.",
};

const LAST_UPDATED = "18 April 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy notice</h1>
      <p className="text-sm text-gray-500">
        Last updated: <strong>{LAST_UPDATED}</strong>
      </p>

      <p>
        This notice explains how <strong>Cliste Systems</strong> (&ldquo;Cliste&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;) — registered in Ireland — processes personal
        data when you (a) sign your salon up for the platform, (b) use the dashboard
        or AI voice agent we operate for your salon, or (c) book an appointment with a
        salon that uses Cliste.
      </p>

      <h2>1. Who we are and our roles under GDPR</h2>
      <ul>
        <li>
          <strong>You, the salon owner</strong>, are the <em>data controller</em> for
          your customers&rsquo; personal data (their name, mobile, email, appointment
          history, voice-call interactions). You decide why and how that data is used.
        </li>
        <li>
          <strong>Cliste</strong> is your <em>data processor</em> for that customer
          data — we only act on your documented instructions (this notice plus the
          Data Processing Agreement available at{" "}
          <Link href="/legal/sub-processors">/legal/sub-processors</Link>).
        </li>
        <li>
          <strong>Cliste</strong> is the <em>controller</em> for our own salon-account
          data (your email, your dashboard activity, billing records).
        </li>
      </ul>

      <h2>2. What data we process</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Examples</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Salon account</td>
            <td>Name, business name, email, phone, password hash</td>
            <td>You at signup</td>
          </tr>
          <tr>
            <td>Customer contact</td>
            <td>Name, mobile, email (optional)</td>
            <td>Public booking form / phone agent / dashboard entry</td>
          </tr>
          <tr>
            <td>Appointment data</td>
            <td>Service, date, price, payment status</td>
            <td>Booking flow</td>
          </tr>
          <tr>
            <td>Voice call data</td>
            <td>
              Caller ID, duration, transcript, AI summary. Audio is{" "}
              <strong>not retained</strong> by Cliste; it is processed live by our
              speech vendors and discarded.
            </td>
            <td>Inbound calls to the salon&rsquo;s Cliste number</td>
          </tr>
          <tr>
            <td>Operational</td>
            <td>Logs, IP-derived country, error reports</td>
            <td>Web/server activity</td>
          </tr>
          <tr>
            <td>Payments</td>
            <td>
              Card data is handled by <strong>Stripe</strong>; Cliste only stores a
              Stripe payment-intent id and last-4-style metadata.
            </td>
            <td>Stripe Checkout / Payment Element</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Lawful bases (Article 6 GDPR)</h2>
      <ul>
        <li>
          <strong>Contract</strong> (Art 6(1)(b)): running your salon&rsquo;s account,
          processing bookings, sending booking confirmations and reminders.
        </li>
        <li>
          <strong>Legal obligation</strong> (Art 6(1)(c)): tax records, anti-fraud
          checks, responding to lawful requests.
        </li>
        <li>
          <strong>Legitimate interests</strong> (Art 6(1)(f)): platform security, fraud
          prevention, service analytics that do not single out individuals, audit
          logging of admin actions.
        </li>
        <li>
          <strong>Consent</strong> (Art 6(1)(a)): only where required — e.g. optional
          marketing emails / SMS, non-essential cookies. Consent can be withdrawn at
          any time without affecting processing already done.
        </li>
      </ul>

      <h2>4. Retention</h2>
      <p>See <a href="#retention">section 11</a> below for our retention schedule.</p>

      <h2>5. International transfers</h2>
      <p>
        Some of our sub-processors (notably AI speech vendors — see{" "}
        <Link href="/legal/sub-processors">/legal/sub-processors</Link>) are based in the
        United States. We rely on the EU&ndash;US Data Privacy Framework where the
        vendor is certified, and on the European Commission&rsquo;s Standard
        Contractual Clauses (SCCs, 2021 module) plus supplementary technical
        measures (TLS in transit, no audio retention, transcript redaction of card
        numbers and government IDs) where it is not.
      </p>

      <h2>6. Your rights (Articles 15&ndash;22 GDPR)</h2>
      <p>
        Customers of a Cliste-using salon should normally exercise their rights with
        the salon, who is the controller. We will assist the salon to fulfil any
        request. You can also email <strong>privacy@clistesystems.ie</strong> directly
        and we will route it.
      </p>
      <ul>
        <li>Access (Art 15) — get a copy of your data.</li>
        <li>Rectification (Art 16) — correct inaccurate data.</li>
        <li>Erasure (Art 17) — &ldquo;right to be forgotten&rdquo;.</li>
        <li>Restriction (Art 18) — pause processing while a complaint is reviewed.</li>
        <li>Portability (Art 20) — get your data in a machine-readable form.</li>
        <li>
          Object (Art 21) — including to any direct marketing (we don&rsquo;t do
          marketing on a salon&rsquo;s customer list).
        </li>
        <li>
          Withdraw consent — for any processing based on consent.
        </li>
        <li>
          Lodge a complaint with the Irish supervisory authority — the{" "}
          <a
            href="https://www.dataprotection.ie"
            target="_blank"
            rel="noreferrer noopener"
          >
            Data Protection Commission
          </a>
          .
        </li>
      </ul>

      <h2>7. Automated decision-making</h2>
      <p>
        The AI voice agent suggests bookings on the salon&rsquo;s behalf. The agent
        does not make legal or similarly significant decisions about you on its own
        — every booking, cancellation or refund is reviewable by the salon, and a
        human can intervene at any point.
      </p>

      <h2>8. AI Act disclosure</h2>
      <p>
        Calls to a salon&rsquo;s Cliste number are answered by an AI agent. The agent
        is required to identify itself as an AI before processing personal data
        beyond your phone number. If you would prefer to speak to a human, ask the
        agent to transfer you or hang up and use the salon&rsquo;s direct line.
      </p>

      <h2>9. Security</h2>
      <p>
        We encrypt data in transit (TLS 1.2+; HSTS preload) and at rest (Supabase
        managed). Access to the production database is restricted to the Cliste
        engineering team, requires SSO, and is audit-logged. Our voice transcripts
        are redacted for card numbers, IBANs and obvious government-ID strings before
        storage. See <a href="/SECURITY.md">SECURITY.md</a> for our vulnerability
        disclosure policy.
      </p>

      <h2>10. Sub-processors</h2>
      <p>
        We rely on a small set of vetted sub-processors. The current list is at{" "}
        <Link href="/legal/sub-processors">/legal/sub-processors</Link>. We notify salons
        in advance of any addition.
      </p>

      <h2 id="retention">11. Retention schedule</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Retention</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Voice call audio</td>
            <td>Not retained</td>
            <td>Streamed to STT/TTS, discarded after the call</td>
          </tr>
          <tr>
            <td>Call transcript &amp; review text</td>
            <td>30 days, then nulled</td>
            <td>Quality review window; AI summary kept for trends</td>
          </tr>
          <tr>
            <td>AI summary</td>
            <td>13 months</td>
            <td>Year-on-year reporting</td>
          </tr>
          <tr>
            <td>Appointments</td>
            <td>For the duration of the salon&rsquo;s account + 7 years (tax)</td>
            <td>Bookkeeping &amp; revenue audit</td>
          </tr>
          <tr>
            <td>OTP challenges</td>
            <td>30 minutes</td>
            <td>Anti-replay; auto-purged</td>
          </tr>
          <tr>
            <td>Anti-abuse rate-limit events</td>
            <td>14 days</td>
            <td>Investigation window</td>
          </tr>
          <tr>
            <td>Security audit log</td>
            <td>2 years</td>
            <td>Incident investigation</td>
          </tr>
          <tr>
            <td>Salon account</td>
            <td>Account lifetime + 90 days</td>
            <td>Recovery / closure handling</td>
          </tr>
        </tbody>
      </table>

      <h2>12. Contact</h2>
      <p>
        Questions or rights requests:{" "}
        <strong>privacy@clistesystems.ie</strong>. We aim to acknowledge within 5
        working days and respond within 30 days (extendable to 90 days for complex
        requests, with notice).
      </p>
    </>
  );
}
