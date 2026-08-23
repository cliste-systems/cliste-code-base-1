# Cara platform rules

Staff-only rules at `/admin/platform-rules` that apply to **every customer** on every call. Store owners cannot edit these in Train Cara or Cara Setup.

## What is editable

| Field | Purpose |
|-------|---------|
| Caller disclosure template | Spoken AI + recording disclosure (`{assistant}` placeholder) |
| Platform behaviour rules | Extra non-negotiable bullets (e.g. don't argue on human transfer) |
| Transfer when enabled / disabled | Built-in transfer copy in the routing section |
| Routing protocol | Confirm-before-send, SMS resend, multi-request handling |

Saving triggers **bulk recompilation** of every organization's `custom_prompt` and refreshes greetings when the disclosure template changes.

## What stays in code

- Payment/security blocks and compliance lint (tenant rules cannot say "skip AI disclosure")
- One-question-per-turn, no guessing, photo handling
- Per-niche vertical boundaries (e.g. retail stock/allergen rules)

## Database

Singleton table `platform_cara_rules` (migration `093_platform_cara_rules.sql`). Service role only — no tenant RLS policies.

## Changing rules safely

1. Edit on `/admin/platform-rules` as `admin@cliste.test` (or allowlisted staff).
2. Confirm save summary (regenerated count, any failures).
3. Spot-check one live org's compiled prompt in Train Cara preview or `organizations.custom_prompt`.
4. For disclosure wording changes, place a test call and confirm the spoken greeting.

## Apply migration

```bash
npx tsx scripts/apply-remote-sql.ts supabase/migrations/093_platform_cara_rules.sql
```

Or via Supabase MCP `apply_migration` when connected.
