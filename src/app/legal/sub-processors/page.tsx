import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sub-processors — Cliste",
  description:
    "List of vendors that process personal data on behalf of Cliste customers.",
};

const LAST_UPDATED = "18 April 2026";

type Sub = {
  name: string;
  purpose: string;
  data: string;
  location: string;
  transferMechanism: string;
  url: string;
};

const SUBS: Sub[] = [
  {
    name: "Supabase (Supabase, Inc.)",
    purpose:
      "Primary database (Postgres), authentication, server-side service role.",
    data: "All salon and customer data (encrypted at rest).",
    location: "EU (Frankfurt) for new EU projects; check your project region.",
    transferMechanism: "EU-region project; SCCs apply if any sub-processor egress.",
    url: "https://supabase.com/privacy",
  },
  {
    name: "Stripe (Stripe Payments Europe Ltd)",
    purpose: "Card payments, payouts (Connect Express), billing, refunds.",
    data: "Cardholder data (tokenised), payer name, email, payment metadata.",
    location: "EU (Ireland) entity; global processing for fraud detection.",
    transferMechanism: "Stripe DPA + SCCs.",
    url: "https://stripe.com/legal/privacy-center",
  },
  {
    name: "Twilio (Twilio Ireland Ltd)",
    purpose: "Outbound SMS (booking confirmations, reminders, OTP, pay-link).",
    data: "Recipient mobile, message body, delivery status.",
    location: "EU (Ireland) entity; global SMS routing through carriers.",
    transferMechanism: "Twilio DPA + SCCs.",
    url: "https://www.twilio.com/legal/privacy",
  },
  {
    name: "LiveKit Cloud (LiveKit, Inc.)",
    purpose: "Real-time SIP / WebRTC for the AI voice agent.",
    data: "Audio in transit (not retained), call metadata, caller phone number.",
    location: "United States; EU edge region in use where available.",
    transferMechanism: "DPF / SCCs.",
    url: "https://livekit.io/privacy",
  },
  {
    name: "OpenAI (OpenAI Ireland Ltd)",
    purpose: "Large-language-model inference for the voice agent and Cara.",
    data: "Conversation transcripts (no audio).",
    location: "EU (Ireland) entity; processing in US.",
    transferMechanism: "DPF / SCCs; zero-data-retention API mode used.",
    url: "https://openai.com/policies",
  },
  {
    name: "OpenRouter (OpenRouter, Inc.)",
    purpose: "Optional LLM gateway for the dashboard Cara assistant.",
    data: "Conversation messages.",
    location: "United States.",
    transferMechanism: "SCCs.",
    url: "https://openrouter.ai/privacy",
  },
  {
    name: "ElevenLabs (ElevenLabs Inc.)",
    purpose: "Text-to-speech for the voice agent.",
    data: "Generated text (transient), audio out.",
    location: "United States.",
    transferMechanism: "DPF / SCCs.",
    url: "https://elevenlabs.io/privacy",
  },
  {
    name: "Deepgram (Deepgram, Inc.)",
    purpose: "Speech-to-text for the voice agent.",
    data: "Audio in (transient), transcript out.",
    location: "United States.",
    transferMechanism: "DPF / SCCs.",
    url: "https://deepgram.com/privacy",
  },
  {
    name: "SendGrid / Twilio SendGrid",
    purpose: "Transactional email (booking confirmations, reminders).",
    data: "Recipient email, message body.",
    location: "United States.",
    transferMechanism: "SCCs (Twilio Group DPA).",
    url: "https://www.twilio.com/legal/privacy",
  },
  {
    name: "Cloudflare (Cloudflare Ireland Ltd)",
    purpose: "DNS, CDN, WAF, Turnstile bot challenge on public booking forms.",
    data: "Request metadata, IP, Turnstile challenge data.",
    location: "EU + global edge.",
    transferMechanism: "Cloudflare DPA + SCCs.",
    url: "https://www.cloudflare.com/privacypolicy",
  },
  {
    name: "Vercel (Vercel Inc.)",
    purpose: "Application hosting (Next.js) for the dashboard and storefront.",
    data: "Server logs, request metadata.",
    location: "United States with EU edge regions.",
    transferMechanism: "DPF / SCCs.",
    url: "https://vercel.com/legal/privacy-policy",
  },
  {
    name: "Railway (Railway Corp.)",
    purpose: "Hosting for the AI voice agent worker.",
    data: "Server logs, request metadata.",
    location: "United States.",
    transferMechanism: "SCCs.",
    url: "https://railway.app/legal/privacy",
  },
  {
    name: "Google Maps Platform (Google Ireland Ltd)",
    purpose: "Storefront map embed and geocoding for the salon directory.",
    data: "Address strings, IP.",
    location: "Global Google infrastructure.",
    transferMechanism: "Google DPA + SCCs.",
    url: "https://policies.google.com/privacy",
  },
];

export default function SubProcessorsPage() {
  return (
    <>
      <h1>Sub-processors</h1>
      <p className="text-sm text-gray-500">
        Last updated: <strong>{LAST_UPDATED}</strong>
      </p>

      <p>
        Cliste relies on the third-party sub-processors below to deliver the
        platform. Each is bound by a written contract that imposes the same
        obligations we owe the salon (controller) under{" "}
        <Link href="/legal/privacy">our privacy notice</Link>.
      </p>

      <p>
        We will give salons at least 30 days&rsquo; notice of any material change
        (added or removed sub-processor, change of region) by email. Salons may
        object on legitimate data-protection grounds — see the privacy notice for
        the process.
      </p>

      <table>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Purpose</th>
            <th>Data</th>
            <th>Location</th>
            <th>Transfer mechanism</th>
          </tr>
        </thead>
        <tbody>
          {SUBS.map((s) => (
            <tr key={s.name}>
              <td>
                <a href={s.url} target="_blank" rel="noreferrer noopener">
                  {s.name}
                </a>
              </td>
              <td>{s.purpose}</td>
              <td>{s.data}</td>
              <td>{s.location}</td>
              <td>{s.transferMechanism}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Standard Contractual Clauses (SCCs)</h2>
      <p>
        Where personal data is transferred outside the EEA we rely on the European
        Commission&rsquo;s 2021 SCCs (controller-to-processor or processor-to-
        processor module as applicable), supplemented by appropriate technical
        measures: TLS 1.2+ in transit, encryption at rest with managed keys, no
        retention of voice audio, transcript redaction of card numbers / IBANs /
        government IDs.
      </p>

      <h2>Data Processing Agreement (DPA)</h2>
      <p>
        Our DPA with salons is included by reference in the privacy notice.
        Enterprise customers may sign a counter-signed copy on request — email{" "}
        <strong>privacy@clistesystems.ie</strong>.
      </p>
    </>
  );
}
