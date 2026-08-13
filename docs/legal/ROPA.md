# Records of Processing Activities (ROPA)

GDPR Article 30(1) record for **Cliste Systems Limited** as **controller** of
its own platform data (sales, billing, support, marketing) and
Article 30(2) record as **processor** of customer-salon data.

Last reviewed: 2026-06-16.

---

## 1. Controller information

- **Name:** Cliste Systems Limited
- **Address:** Ireland (full address on request)
- **Contact:** privacy@hellocara.ie
- **DPO / privacy lead:** Brendan O'Toole (acting). Cliste does not
  meet the Article 37 threshold for mandatory DPO appointment;
  this contact is the Single Point of Contact for the DPC.

---

## 2. Article 30(1) — Cliste as controller

### 2.1 Account holders & operator users

| Field                | Value                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Purpose              | Authentication, billing, account administration, support                                      |
| Lawful basis         | Art 6(1)(b) contract; Art 6(1)(c) for invoicing/tax records                                   |
| Data categories      | Email, name, hashed password, role, IP / user agent, plan tier, Stripe customer / subscription IDs |
| Data subject groups  | Salon owners, operators, agency staff                                                         |
| Recipients           | Stripe (billing), Supabase (database), Vercel (hosting), Sentry (errors) |
| International        | Yes — see DPA Annex III                                                                       |
| Retention            | Account lifetime + 6 years (tax). Inactive accounts purged after 13 months.                  |
| Security measures    | DPA Annex II                                                                                  |

### 2.2 Onboarding leads

| Field                | Value                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Purpose              | Sales follow-up, conversion to paying customer                                                 |
| Lawful basis         | Art 6(1)(b) pre-contract; Art 6(1)(f) legitimate interests for prospects                       |
| Data categories      | Salon name, owner name, email, phone, geographic area                                          |
| Recipients           | None outside Cliste                                                                            |
| International        | Same as 2.1                                                                                    |
| Retention            | 13 months from last interaction; deleted on request                                            |

### 2.3 Security audit log

| Field             | Value                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| Purpose           | Detect and investigate unauthorised access; comply with Art 32 / 33              |
| Lawful basis      | Art 6(1)(c); Art 6(1)(f)                                                         |
| Data categories   | User ID, email, IP, user-agent, event type, target, metadata                     |
| Retention         | 24 months (purged by retention cron)                                             |

---

## 3. Article 30(2) — Cliste as processor

For all processing in this section the **controller is the customer
salon**. Cliste's processing is governed by the DPA at `docs/legal/DPA.md`.

### 3.1 Appointments

| Field             | Value                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| Categories        | Customer name, mobile phone, email (optional), service, time, price, payment status, booking reference |
| Subjects          | Salon's customers                                                                 |
| Recipients        | Stripe (where the customer pays), SendGrid (email), Twilio (SMS)                 |
| International     | See DPA Annex III                                                                |
| Retention         | Lifetime of contract + per-customer erasure on request. Anonymised on Art 17 request, time/price retained for tax (6 years). |

### 3.2 AI voice agent calls

| Field             | Value                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| Categories        | Caller phone number, call duration, outcome, raw transcript, staff-facing transcript review, AI summary, call recording (transient via LiveKit; not retained at rest) |
| Subjects          | People calling the salon's line                                                   |
| Recipients        | LiveKit (real-time voice + in-call STT), OpenRouter (LLM routing), ElevenLabs (TTS), Twilio (SIP/SMS) |
| International     | See DPA Annex III                                                                |
| Retention         | Transcripts: 30 days. AI summaries + caller numbers: 13 months. (Daily cron.)    |

### 3.3 Action inbox tickets

| Field             | Value                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| Categories        | Caller number, summary text generated by the agent                                |
| Subjects          | Salon's customers / callers                                                       |
| Retention         | Tied to the parent appointment / call; erasable via Art 17 tool                  |

### 3.4 Blocked caller numbers

| Field             | Value                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| Purpose           | Prevent unwanted repeat callers from reaching the AI agent                        |
| Lawful basis      | Art 6(1)(f) legitimate interests (business protection; minimal data)             |
| Categories        | Caller phone number (E.164), optional owner note, created timestamp              |
| Subjects          | People the salon owner has blocked                                                |
| Recipients        | None outside Cliste; voice worker reads list for pre-answer gate                 |
| Retention         | Until owner removes block or Art 17 erasure for that phone number                |

### 3.5 Outbound SMS / Email confirmations

| Field             | Value                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| Categories        | Phone / email, message body (booking metadata)                                    |
| Recipients        | Twilio (SMS), SendGrid (email)                                                    |
| International     | See DPA Annex III                                                                |
| Retention         | We do not retain message content beyond the carrier delivery receipt.            |

---

## 4. Recipients summary

A current list of recipients (sub-processors) is at
`/legal/sub-processors`.

## 5. Security measures

See DPA Annex II.

## 6. Review cadence

This document is reviewed at least annually, on every new
sub-processor, and within 30 days of any incident triggering Article 33
notification.
