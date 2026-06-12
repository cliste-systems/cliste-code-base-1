# Voice compliance operational checklist

**Purpose:** Verify production voice pipeline meets GDPR, EU AI Act Art 50, and Irish
transparency expectations. Run before go-live on each DID and quarterly thereafter.

**Last updated:** 2026-06-12

---

## 1. AI disclosure (EU AI Act Art 50)

- [ ] Place a test call to each live DID.
- [ ] Confirm the **first spoken turn** includes: AI self-identification **and**
      recording/transcription notice (matches `voiceLegalDisclosure()` in
      `src/lib/voice-greeting.ts`).
- [ ] Check worker logs for `disclosure_confirmed: true` on `POST /api/voice/call-complete`.
- [ ] If disclosure is missing, block the number until the worker greeting is fixed.

## 2. Recording & audio retention

- [ ] Twilio: **Call Recording = OFF** on every Cliste SIP trunk / number.
- [ ] LiveKit: **Egress recording = OFF**; no S3/GCS egress destinations.
- [ ] Voice worker: does **not** persist raw audio to disk or object storage.
- [ ] Confirm Cliste `call_logs` receives transcripts only (redacted server-side).

## 3. EU data routing (GDPR Chapter V)

| Vendor | Target configuration | Verified |
| ------ | -------------------- | -------- |
| Railway voice worker | EU West region | [ ] |
| LiveKit SIP | `*.eu.sip.livekit.cloud` (Frankfurt) | [ ] |
| LiveKit WebRTC | Protocol region pinning (Scale+) | [ ] |
| ElevenLabs TTS | `api.eu.residency.elevenlabs.io` + Zero Retention (Enterprise) | [ ] |
| OpenRouter LLM | `https://eu.openrouter.ai` (Enterprise) | [ ] |
| SendGrid | EU subuser + `api.eu.sendgrid.com` | [ ] |

Document actual routing in the sub-processor annex if any vendor remains on US endpoints
(SCCs / DPF must be on file).

## 4. Webhook security

- [ ] `CLISTE_VOICE_WEBHOOK_SECRET` set in app **and** worker (matching values).
- [ ] Worker sends `called_number` on every `call-complete` request.
- [ ] `CLISTE_VOICE_ALLOW_LEGACY_ORG_ID` is **unset** in production.

## 5. Sign-off

| Role | Name | Date |
| ---- | ---- | ---- |
| Engineering | | |
| Privacy lead | | |

---

See also: `docs/VOICE-WORKER-CONTRACT.md`, `docs/legal/DPIA.md` §7, `docs/legal/GDPR-VOICE-AGENTS-IRELAND.md`.
