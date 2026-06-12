# Breach register

Internal log of personal-data security incidents. Maintained by the privacy lead.
Do not publish this file — controller notification uses templates in
`docs/legal/BREACH-RUNBOOK.md`.

**Last reviewed:** 2026-06-12

---

## Active incidents

| ID | Opened | Severity | Summary | Status | DPC notified | Controllers notified |
| -- | ------ | -------- | ------- | ------ | ------------ | -------------------- |
| — | — | — | _No open incidents_ | — | — | — |

---

## Closed incidents

| ID | Opened | Closed | Severity | Summary | Root cause | Remediation |
| -- | ------ | ------ | -------- | ------- | ---------- | ----------- |
| BR-2026-06-001 | 2026-06-12 | 2026-06-12 | Critical (latent) | Legacy anon RLS on `organizations` exposed full tenant rows via public anon key | Storefront migration 002 never revoked when UI retired | Migration `064_revoke_storefront_anon_access` applied; API log review found no evidence of external `GET /rest/v1/organizations` scraping |

---

## How to log an incident

1. Assign reference `BR-YYYY-MM-NNN` (sequential per month).
2. Follow `docs/legal/BREACH-RUNBOOK.md` for triage, containment, and notification.
3. Add a row to **Active incidents** within 24 hours of discovery.
4. Move to **Closed incidents** when remediated; retain for 24 months minimum.

---

## Template row (copy into Active incidents)

```
| BR-2026-06-001 | 2026-06-12 | Medium | [One-line summary] | Investigating | No | No |
```
