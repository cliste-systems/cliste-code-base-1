# Kavanaghs 4-part demo — script card

**Line:** +353749759508  
**Dashboard:** kavanaghs@cliste.test / KavanaghsDemo2026!  
**URL:** http://localhost:3001/dashboard  

Run readiness: `npx tsx scripts/rehearse-kavanaghs-demo.ts --manager-phone +353872715938`

---

## Before Garreth arrives

1. `npm run dev -- -p 3001`
2. `ngrok http 3001` → `npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --ngrok-url https://….ngrok-free.app`
3. Top up **LiveKit inference credits** (avoid long silences)
4. Hard refresh dashboard; wide screen (≥1024px)

---

## Part 1 — FAQ → Call History (~3 min)

**Say:** “What time do you close on Sunday?” → “Where is the bakery?”

**Show:** Call History — **Answered**, no Action Inbox ticket

**Talk track:** Most calls — answered and logged, no staff time.

---

## Part 2 — Unsure → Action Inbox (~4 min)

**Say:** “Can I use my Real Rewards points at Applegreen?” → give your name when asked

**Show:** Action Inbox — **Needs review**

**Talk track:** She won’t guess — it goes to the Action Inbox.

---

## Part 3 — Cake → Dashboard home (~4 min)

**Say:** Birthday cake for Saturday, chocolate sponge, 12 people, “Happy 8th Birthday Jamie”, your name

**Show:** Dashboard home — **Today’s requests** → **Pricing question**

**Talk track:** Bakery team gets the details and calls back — no price on the phone.

---

## Part 4 — Manager → Action Inbox + SMS (~4 min)

**Say:** “I need to speak to the store manager — my home delivery never arrived yesterday” + your name

**Show:** Action Inbox — **Complaint** + Garreth’s phone SMS

**Talk track:** When someone needs you, you get the text — not tied to the phone all day.

---

## After the demo

`npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --restore`
