<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Product surfaces

Ship **real behaviour only**: no demo niches, fake filters, “coming soon” controls, or copy that implies a feature works when it does not. Lists and search must reflect **live data** (e.g. directory options from the database). If a control is not wired end-to-end yet, **omit it** or implement it—do not leave placeholder UI.

# Supabase access — act, don’t ask

You have the Supabase MCP attached to this repo. When a task needs database work (applying a migration, inserting test rows, smoke-testing Realtime, querying state to confirm a fix, etc.) **just do it via MCP**. Do not ask the user to run SQL for you, and do not ask for permission before inserting clearly-marked test rows into dev data. Test rows must carry an obvious marker (e.g. `[smoke test]` in a text field, a caller number like `+1-555-SMOKE-TEST`, or a `RT-TEST-*` booking reference) so they are trivial to clean up afterwards, and you should offer cleanup once the user has confirmed the behaviour.

When acting against Supabase, prefer `apply_migration` for DDL (so it is captured in `supabase/migrations/`) and `execute_sql` for reads and for one-off test inserts. Never hardcode generated IDs from one migration into another.
