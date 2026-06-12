/** Sub-processor list version — bump when SUB_PROCESSORS changes; triggers customer email notice. */
export const SUB_PROCESSOR_LIST_VERSION = "2026-06-12";

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
    location: "EEA — production functions in dub1 (Dublin, Ireland).",
    transferMechanism:
      "Primary compute in EU; global CDN / DDoS edge may see request metadata (SCCs).",
    url: "https://vercel.com/legal/privacy-policy",
    group: "eea-hosting",
  },
  {
    name: "Railway (Railway Corp.)",
    purpose: "Hosting for the AI voice agent worker.",
    data: "Server logs, call-handling metadata (not stored transcripts).",
    location: "EEA — Railway EU West.",
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
    purpose:
      "Irish phone numbers (SIP ingress), outbound SMS (e.g. Action Inbox alerts).",
    data: "Caller/callee numbers, message body, delivery status, SIP metadata.",
    location: "EU entity; carrier routing may leave EEA.",
    transferMechanism: "Twilio DPA + SCCs.",
    url: "https://www.twilio.com/legal/privacy",
    group: "global-services",
  },
  {
    name: "SendGrid / Twilio SendGrid",
    purpose: "Transactional email (e.g. Action Inbox, account notices).",
    data: "Recipient email, message body.",
    location:
      "United States (global API today). EU data residency available (EU subuser + api.eu.sendgrid.com).",
    transferMechanism: "SCCs (Twilio Group DPA); EU residency when configured.",
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
    purpose:
      "Real-time SIP / WebRTC, in-call speech recognition (LiveKit Agents), and voice agent runtime.",
    data: "Audio in transit (not retained), call metadata, caller number, transient transcripts.",
    location:
      "Inbound telephony: EU SIP (Frankfurt) via Twilio trunk. WebRTC / agent media: global routing until LiveKit protocol region pinning is enabled.",
    transferMechanism:
      "EU SIP path stays in EEA; DPF / SCCs for any WebRTC traffic routed outside EEA until protocol pinning is on.",
    url: "https://livekit.io/privacy",
    group: "us-voice",
  },
  {
    name: "ElevenLabs (ElevenLabs Inc.)",
    purpose: "Text-to-speech for the voice agent and onboarding voice preview.",
    data: "Generated speech text (transient).",
    location:
      "United States (global API). EU data residency available on Enterprise plans.",
    transferMechanism: "EU–US DPF and/or SCCs.",
    url: "https://elevenlabs.io/privacy",
    group: "us-voice",
  },
  {
    name: "OpenRouter (OpenRouter, Inc.)",
    purpose:
      "LLM routing for the voice agent and dashboard AI helpers (onboarding, knowledge).",
    data: "Conversation / business text (no audio). Underlying model providers vary.",
    location:
      "United States. EU in-region routing available for enterprise accounts (eu.openrouter.ai).",
    transferMechanism: "SCCs; ZDR / provider allowlists where configured.",
    url: "https://openrouter.ai/privacy",
    group: "us-voice",
  },
  {
    name: "Google (Google Ireland Ltd) — optional",
    purpose: "Geocoding Irish service-area addresses when a Maps API key is set.",
    data: "Address / Eircode text sent for geocoding.",
    location: "EU entity; processing may occur globally.",
    transferMechanism: "Google Cloud DPA + SCCs.",
    url: "https://policies.google.com/privacy",
    group: "global-services",
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
    location: "EEA (Ireland / EU West)",
    transfers: "CDN edge metadata may leave EEA (SCCs).",
  },
  {
    category: "Real-time voice & speech recognition",
    purpose:
      "Connect phone calls to the AI agent; in-call speech recognition via LiveKit Agents (audio not retained at rest).",
    location: "EU SIP (Frankfurt) for inbound calls; WebRTC global until pinned",
    transfers: "None on SIP path; DPF / SCCs for unpinned WebRTC.",
  },
  {
    category: "Speech & language AI",
    purpose: "Text-to-speech and LLM conversation (transient).",
    location: "United States (EU options for some vendors)",
    transfers: "DPF / SCCs.",
  },
  {
    category: "Payments, messaging & security",
    purpose: "Billing, SMS/email alerts, DDoS protection.",
    location: "EU entity; some US / global processing",
    transfers: "Vendor DPAs + SCCs.",
  },
] as const;

export const SUB_PROCESSOR_GROUP_LABELS: Record<SubProcessorGroup, string> = {
  "eea-hosting": "EEA hosting — primary data & compute",
  "us-voice": "Voice AI — transient processing (US today; EU options noted)",
  "global-services": "Payments, messaging & security",
};
