# PBX transfer setup (retail)

Ops runbook for configuring store phone systems so Cara can offer verified live transfers. **Grandstream-first**, vendor-neutral schema.

## Principles

1. **Direct-dial (DDI) only** — Cara transfers to `store_departments.direct_dial_e164`. PBX extensions are diagnostic only and are never compiled into prompts or routing.
2. **No DDI range → message-taking** — When `has_ddi_range = false`, every department takes messages. Do not enable DTMF auto-attendant workarounds.
3. **Verification required** — `transfer_verified_at` is set only by a successful test call (`verification_call: true`, `outcome: transferred`, `transfer_connected: true`). Staff cannot tick a checkbox in the dashboard.
4. **Invalidation on change** — Saving transfer method, DDI question, routing mode, or any department DDI clears verification.

## Admin workflow (Train Cara §5)

1. Record system type, vendor (default Grandstream), model, handset count, installer name/contact, trunk provider.
2. Answer the DDI question: Yes / No / Don't know (cannot leave unset).
3. If **Yes** — map each active department's direct-dial E.164 in the department table.
4. Set transfer method (`sip_refer` preferred) and warm-transfer hardware status (`go` when ready).
5. Review the verdict banner (green / amber / grey) and run **Test transfer** when amber for `not_verified`.
6. Check **Cliste readiness** — assigned `phone_numbers` row and trunk type.

## Installer email template

Use **Email installer** or **Copy installer request** in §5. Body is generated from `buildInstallerEmailBody()` in `src/lib/transfer-capability-messages.ts`. Ask:

- DDI range vs extensions only
- Per-department E.164 list
- Cost/timeline to add DDIs if needed

## Grandstream / on-prem PBX (typical)

1. Confirm main line and Cliste DID routing (`call_routing_mode = cliste_number` — not `forward_all`, which would loop).
2. Ensure each department has an external DDI mapped to the correct handset or ring group.
3. Configure SIP trunk toward Cliste/Twilio with **REFER** enabled for warm transfer.
4. Mark warm-transfer hardware **go** only after REFER and audio path are confirmed on a test handset.
5. Run verification call from a mobile to the Cliste number; ask for a department; confirm the correct handset rings.

## Twilio / Cliste trunk notes

- **Elastic SIP Trunking** with SIP REFER is the target path for `transfer_method: sip_refer`.
- **Programmable Voice** numbers may need trunk migration before REFER works — §5 Cliste readiness line flags this.
- Worker dials `routing_links[].url` (E.164) for `targetType: phone`; empty URL falls back to `organizations.fallback_number`.

## Worker contract (call-complete)

On transfer attempts, POST:

```json
{
  "outcome": "transferred",
  "transfer_department": "Deli counter",
  "transfer_target": "+35311223344",
  "transfer_connected": true,
  "verification_call": true
}
```

- Failed connect: `transfer_connected: false`, take a message, `outcome: action_created` (not `transferred`).
- Verification success stamps `store_phone_systems.transfer_verified_at` via `stamp_store_transfer_verified` RPC.

## What we explicitly reject

- Using DTMF / IVR extension dialling as a transfer target
- Putting extensions or E.164 numbers in `custom_prompt`
- Letting tenants or generic saves set `transfer_verified_at`

## Tenant visibility

- **Settings → Phone setup** — read-only department transfer vs message-taking, last verified date, support ticket CTA.
- **Home → Transfer health** — attempted `transferred` vs `transfer_connected = true` in the selected metric range.

## Related

- `docs/VOICE-WORKER-CONTRACT.md` — payload fields
- `supabase/migrations/092_store_transfer_capability.sql` — schema
- `src/lib/transfer-capability.ts` — single source of truth for gating
