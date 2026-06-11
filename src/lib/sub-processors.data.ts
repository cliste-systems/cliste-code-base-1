/** Sub-processor registry — update here; legal pages import this source. */

export type SubProcessorGroup = "eea-hosting" | "us-voice" | "global-services";

export type SubProcessor = {
  name: string;
  purpose: string;
  data: string;
  location: string;
  transferMechanism: string;
  url: string;
  group: SubProcessorGroup;
};

/** Named vendors (required in DPA / customer annex — Art 28 GDPR, SCC Module 3). */
export const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: "Supabase (Supabase, Inc.)",
    purpose: "Database, authentication, server-side operations.",
    data: "Business and caller data (encrypted at rest).",
    location: "EEA — AWS eu-west-1 (Ireland). Primary data store.",
    transferMechanism: "No third-country transfer for primary database.",
    url: "https://supabase.com/privacy",
    group: "eea-hosting",
  },
  {
    name: "Vercel (Vercel Inc.)",
    purpose: "Application hosting (Next.js dashboard and APIs).",
    data: "Server logs, request metadata.",
    location: "EEA — production deployment in EU region.",
    transferMechanism: "Primary app region EU; global CDN edge may see request metadata (SCCs).",
    url: "https://vercel.com/legal/privacy-policy",
    group: "eea-hosting",
  },
  {
    name: "Railway (Railway Corp.)",
    purpose: "Hosting for the AI voice agent worker.",
    data: "Server logs, call-handling metadata (not stored transcripts).",
    location: "EEA — worker deployed in EU region.",
    transferMechanism: "EU hosting; SCCs available if configuration changes.",
    url: "https://railway.app/legal/privacy",
    group: "eea-hosting",
  },
  {
    name: "Stripe (Stripe Payments Europe Ltd)",
    purpose: "Platform subscription billing and customer portal.",
    data: "Billing contact, payment method tokens, invoice metadata.",
    location: "EU (Ireland) entity; global processing for fraud detection.",
    transferMechanism: "Stripe DPA + SCCs.",
    url: "https://stripe.com/legal/privacy-center",
    group: "global-services",
  },
  {
    name: "Twilio (Twilio Ireland Ltd)",
    purpose: "Outbound SMS (e.g. Action Inbox alerts, optional notifications).",
    data: "Recipient mobile, message body, delivery status.",
    location: "EU entity; SMS routed via carriers globally.",
    transferMechanism: "Twilio DPA + SCCs.",
    url: "https://www.twilio.com/legal/privacy",
    group: "global-services",
  },
  {
    name: "SendGrid / Twilio SendGrid",
    purpose: "Transactional email (e.g. Action Inbox, account notices).",
    data: "Recipient email, message body.",
    location: "United States.",
    transferMechanism: "SCCs (Twilio Group DPA).",
    url: "https://www.twilio.com/legal/privacy",
    group: "global-services",
  },
  {
    name: "Cloudflare (Cloudflare Ireland Ltd)",
    purpose: "DNS, CDN, WAF, Turnstile on login.",
    data: "Request metadata, IP, challenge tokens.",
    location: "EU entity; global edge network.",
    transferMechanism: "Cloudflare DPA + SCCs.",
    url: "https://www.cloudflare.com/privacypolicy",
    group: "global-services",
  },
  {
    name: "LiveKit Cloud (LiveKit, Inc.)",
    purpose: "Real-time SIP / WebRTC for the AI voice agent.",
    data: "Audio in transit (not retained), call metadata, caller number.",
    location: "United States.",
    transferMechanism: "EU–US Data Privacy Framework (DPF) and/or SCCs.",
    url: "https://livekit.io/privacy",
    group: "us-voice",
  },
  {
    name: "Deepgram (Deepgram, Inc.)",
    purpose: "Speech-to-text for the voice agent.",
    data: "Audio in (transient), transcript out.",
    location: "United States.",
    transferMechanism: "SCCs; transient processing only.",
    url: "https://deepgram.com/privacy",
    group: "us-voice",
  },
  {
    name: "ElevenLabs (ElevenLabs Inc.)",
    purpose: "Text-to-speech for the voice agent.",
    data: "Generated speech text (transient).",
    location: "United States.",
    transferMechanism: "EU–US DPF and/or SCCs.",
    url: "https://elevenlabs.io/privacy",
    group: "us-voice",
  },
  {
    name: "OpenAI (OpenAI Ireland Ltd)",
    purpose: "LLM inference for the voice agent.",
    data: "Conversation text (no audio retention by Cliste).",
    location: "EU entity; processing may occur in the United States.",
    transferMechanism: "EU–US DPF and/or SCCs; API settings limiting retention where offered.",
    url: "https://openai.com/policies",
    group: "us-voice",
  },
];

/** Category summary for public privacy pages (Art 13/14 — categories of recipients). */
export const SUB_PROCESSOR_CATEGORIES_PUBLIC = [
  {
    category: "Cloud database & authentication",
    purpose: "Store business accounts, caller records, transcripts, and dashboard data.",
    location: "EEA (Ireland)",
    transfers: "None for primary storage.",
  },
  {
    category: "Application & worker hosting",
    purpose: "Run the dashboard, APIs, and real-time voice worker.",
    location: "EEA",
    transfers: "CDN edge metadata may leave EEA (SCCs).",
  },
  {
    category: "Real-time voice transport",
    purpose: "Connect phone calls to the AI agent (audio not retained at rest).",
    location: "United States",
    transfers: "DPF / SCCs.",
  },
  {
    category: "Speech & language AI",
    purpose: "Live speech-to-text, text-to-speech, and conversation (transient).",
    location: "United States (EU entity where applicable)",
    transfers: "DPF / SCCs.",
  },
  {
    category: "Payments, messaging & security",
    purpose: "Billing, SMS/email alerts, DDoS protection.",
    location: "EU entity; some US processing",
    transfers: "Vendor DPAs + SCCs.",
  },
] as const;

export const SUB_PROCESSOR_GROUP_LABELS: Record<SubProcessorGroup, string> = {
  "eea-hosting": "EEA hosting — primary data",
  "us-voice": "United States — voice AI (transient; no audio retention by Cliste)",
  "global-services": "Payments, messaging & security",
};
