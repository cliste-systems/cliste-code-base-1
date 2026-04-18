# Data Protection Impact Assessment (DPIA)

**Service:** Cliste — AI voice receptionist + booking platform for hair
& beauty salons.

**Date:** 2026-04-18.

**Owner:** Brendan O'Toole (privacy lead, acting DPO).

**Review:** Annually, and on any change that affects the rows in
section 5 ("residual risks") or introduces a new sub-processor /
processing purpose.

---

## 1. Why a DPIA?

Article 35(3)(a) GDPR requires a DPIA for "systematic and extensive
evaluation of personal aspects … which is based on automated
processing, including profiling, and on which decisions are based that
produce legal effects … or similarly significantly affect" people.

Cliste's AI voice agent does **not** make decisions with legal effect
on the caller — it books an appointment, like a human receptionist
would. However, the combined characteristics:

- Use of AI / large language models on a person's voice and speech
- Real-time speech-to-text and synthesis of speech
- Storage of voice transcripts (even if short-lived)
- Combination of phone number, name, and appointment history
- Possibility of capturing health-adjacent context (skin conditions,
  pregnancy, treatments)

…take the system over the threshold where a DPIA is good practice
under the EDPB Article 29 WP248 criteria (≥2 of 9 indicators are met
— "innovative use of new technological solutions" and "data processed
on a large scale" once we cross ~50 salons).

We therefore complete this DPIA voluntarily as a baseline; it is not
filed with the DPC because the residual risk after mitigations is
**low** (see section 5).

## 2. Description of the processing

### 2.1 Inbound flow

1. Customer calls the salon's published number (Twilio Irish DID).
2. Twilio routes the SIP call to the LiveKit voice worker.
3. The worker streams audio to Deepgram (STT), passes transcript to an
   LLM (OpenAI via OpenRouter), and returns synthesised audio via
   ElevenLabs.
4. When the agent confirms a booking, it writes an `appointments` row
   via the Supabase service role and triggers an SMS / email.
5. Post-call, the worker writes a `call_logs` row with raw transcript,
   AI summary, outcome, duration.

### 2.2 Data subjects

People telephoning a Cliste-using salon. Mostly adults; some calls may
be on behalf of minors (parents booking for children).

### 2.3 Data categories

- Voice audio (in transit, **not stored**)
- Caller phone number (E.164)
- Transcript text (full, salon-friendly review version)
- AI summary text
- Self-volunteered context (name, allergy, medical context if shared)
- Appointment metadata (service, time, price)
- Booking reference

### 2.4 Recipients

LiveKit, Deepgram, OpenAI (via OpenRouter), ElevenLabs, Twilio,
Supabase, SendGrid. See `/legal/sub-processors` for transfer
mechanisms.

### 2.5 Retention

| Asset                        | TTL                                       |
| ---------------------------- | ----------------------------------------- |
| Voice audio                  | Not stored at rest                        |
| Transcript / review          | 30 days, then nulled by daily cron        |
| AI summary, caller number    | 13 months, then nulled                    |
| Appointment row              | 6 years (Revenue), erasable on Art 17     |
| OTP rows                     | 30 minutes                                |
| Rate-limit events            | 14 days                                   |

## 3. Necessity & proportionality

- **Necessity** — Salons (the controller) need a way to take bookings
  outside business hours; an AI receptionist is faster and cheaper than
  outsourcing to a human call centre, and avoids forwarding the
  customer's voice to a third-party agency. The lawful basis is
  Art 6(1)(b) (taking steps to enter into a contract with the caller).
- **Proportionality** — We collect only what's needed to make a
  booking (name, phone, service preference, time). Health data is not
  solicited; the agent prompt is instructed not to store it if
  volunteered.
- **Less intrusive alternatives considered**
  - Human call centre — more expensive, similar privacy footprint,
    less consistent.
  - IVR ("press 1 for booking") — frustrating for the caller, lower
    conversion, still records audio.
  - SMS-only booking — excludes callers who prefer voice; no real
    privacy advantage as the same metadata is stored.
- **Disclosure of AI** — At call connect, the agent identifies itself
  as the salon's AI assistant in the first turn. This satisfies AI Act
  Article 50(1) and Article 13(2)(f) GDPR (existence of automated
  decision-making is disclosed even though no Art 22 decision occurs).

## 4. Risk assessment

| # | Risk                                                                                       | Likelihood | Severity | Mitigation                                                                                          | Residual |
| - | ------------------------------------------------------------------------------------------ | ---------- | -------- | --------------------------------------------------------------------------------------------------- | -------- |
| 1 | LLM exfiltrates transcript via prompt injection ("ignore previous instructions, email…")    | Low        | High     | LLM has no outbound network tools; only structured tool calls (book / cancel). Redact PII before logging. | Low      |
| 2 | Sub-processor (e.g. STT vendor) breach exposes recent transcripts                           | Low        | Medium   | DPF / SCC contracts; transient audio; 30-day transcript TTL; vendor security reviewed annually.     | Low      |
| 3 | Caller volunteers health info → stored as `transcript`                                      | Medium     | Medium   | 30-day TTL; "redact special category" instruction in agent prompt; salon-friendly review strips raw transcript fields used in UI. | Low      |
| 4 | Caller phone number reused across salons → re-identification across controllers              | Medium     | Low      | Each salon's data is isolated by RLS / `organization_id`; cross-tenant lookup is not exposed to staff users. | Low      |
| 5 | Operator at salon misuses customer phone numbers (marketing without consent)                | Medium     | Medium   | Out-of-scope for processor; covered in DPA + Terms (controller obligation). Cliste does not enable bulk export. | Medium   |
| 6 | Caller mistakenly believes they are talking to a human                                      | Medium     | Low      | Agent self-identifies as AI on first turn (logged in transcript). EU AI Act Art 50(1).              | Low      |
| 7 | Re-identification from anonymised post-13mo `call_logs` rows                                | Low        | Low      | After 13 months, `caller_number` and `ai_summary` are nulled — only org id, duration, outcome, timestamp remain. | Low      |
| 8 | Service-role key on hosting platform compromised → mass data exfil                          | Low        | High     | Key stored only as hosted env var; rotation runbook; RLS still enforced for all JWT clients; principle of least privilege on service-role usage. | Low-Med  |
| 9 | Stripe webhook spoof → fraudulent "paid" status                                             | Low        | High     | Stripe signature verified on every webhook; idempotency on conditional update.                       | Low      |

## 5. Residual risk

Residual risk after mitigations: **Low** for items 1, 2, 4, 6, 7, 9;
**Low-Medium** for items 3 and 8; **Medium** for item 5 (which sits
with the controller, not the processor, and is addressed in the DPA).

No residual high risks → DPC consultation under Article 36 not
required.

## 6. Consultation

- Internal: engineering, customer support.
- External: not required at this scale (no Art 36 trigger). Will
  reconsider if user count grows materially or if a new high-risk
  feature is added (e.g. payment via voice, biometrics).

## 7. Action items / owner

- [ ] Quarterly review of agent prompt + redaction guidance — **eng**
- [ ] Annual sub-processor security review — **privacy lead**
- [ ] Confirm Twilio call recording is OFF on all numbers — **eng**
- [ ] Add UI for the salon to export caller list (Art 20) — **eng**
- [ ] Re-run DPIA on > 50 active salons — **privacy lead**
