# Data Retention Schedule

The authoritative public-facing version of this schedule is at
`/legal/privacy`. This document is the operational mirror — what the
system actually does, where, and how often.

Last reviewed: 2026-04-18.

---

## 1. Customer-facing data

| Asset                                       | TTL                  | Mechanism                                                                                  |
| ------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| `appointments`                              | 6 years (tax)         | Manual erasure via `/dashboard/privacy` (Art 17). Anonymised — name/phone/email replaced.   |
| `call_logs.transcript`, `transcript_review` | 30 days              | Daily cron `/api/cron/data-retention` nulls fields                                          |
| `call_logs.ai_summary`, `caller_number`     | 13 months            | Same cron, longer cutoff                                                                   |
| `call_logs` row itself                      | Indefinite (org-only) | Kept for ops reporting; contains only org id + duration + outcome after 13 months          |
| `action_tickets`                            | Tied to parent call   | Erasable via `/dashboard/privacy`                                                          |
| Voice audio (LiveKit / SIP)                 | Not stored at rest   | LiveKit egress recording disabled; Twilio recording disabled                                |
| `public_booking_otp_challenges`             | 30 minutes           | Daily cron deletes rows older than 30 min                                                  |
| `public_booking_rate_events`                | 14 days              | Daily cron deletes                                                                         |
| Outbound SMS / email content                 | Not retained         | We do not log message body server-side after delivery                                      |

## 2. Operator / account data

| Asset                                       | TTL                  | Mechanism                                                                                  |
| ------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| `auth.users`, `profiles`                    | Account lifetime + 30d | Admin "delete user" cascades; manual purge after subscription end                         |
| `organizations` (suspended)                 | 13 months from suspension | Manual purge runbook                                                                  |
| `security_auth_events`                      | 24 months            | Daily cron deletes older                                                                   |
| `onboarding_applications`                   | 13 months from last update | Manual purge runbook                                                                  |
| Stripe customer / subscription              | Per Stripe retention | Stripe-controlled; we hold IDs only                                                        |

## 3. System / observability

| Asset                                       | TTL                  | Mechanism                                                                                  |
| ------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| Vercel access logs                          | 30 days              | Vercel default                                                                             |
| Supabase Postgres logs                      | 7 days               | Supabase default                                                                           |
| Sentry error events                          | 90 days              | Sentry default                                                                             |
| Backups (Postgres)                          | 35 days              | Supabase managed PITR                                                                      |

## 4. Cron schedule

`vercel.json` registers daily crons:

- `/api/cron/data-retention` at 03:45 UTC — see this document.
- `/api/cron/appointment-reminders` — operational, not retention.
- `/api/cron/usage-sync` — billing reconciliation.
- `/api/cron/phone-pool-refill` — operational.

The retention cron is **idempotent**: re-running on the same day is a
no-op.

## 5. Customer-driven erasure (Article 17)

Salons can use `/dashboard/privacy` to:

- Export everything Cliste holds for a phone number (Article 15).
- Erase a customer — name, phone, email replaced with sentinel values;
  appointment timing and price retained for tax.

Both actions are recorded in `security_auth_events` with
`gdpr_data_export` / `gdpr_erasure` event types.

## 6. Backup expiry

Hard deletions are reflected in Postgres point-in-time-recovery
backups for up to 35 days. After that window the deletion is
irrecoverable. We document this in `/legal/privacy` so customers know
the realistic timeframe.

## 7. Review

This schedule is reviewed:

- Annually by the privacy lead.
- On any new table creation that holds personal data (definition of
  done for any DB migration introducing PII).
- After any DPC guidance / case-law change relevant to the salon
  industry.
