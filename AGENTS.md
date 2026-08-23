<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Product surfaces

Ship **real behaviour only**: no demo niches, fake filters, “coming soon” controls, or copy that implies a feature works when it does not. Lists and search must reflect **live data** (e.g. directory options from the database). If a control is not wired end-to-end yet, **omit it** or implement it—do not leave placeholder UI.

See [docs/VERTICALS.md](docs/VERTICALS.md) for how to add a new business vertical (pack object + copy registries).

# Act via tools — don’t ask

Use MCP, CLIs (`vercel`, `supabase`, `gh`, Railway), and project scripts to complete infra and ops work. **Do not ask the user** to run SQL, open dashboards, or paste commands you can run yourself.

# Supabase access

You have the Supabase MCP attached to this repo. When a task needs database work (applying a migration, inserting test rows, smoke-testing Realtime, querying state to confirm a fix, etc.) **just do it via MCP**. Do not ask the user to run SQL for you, and do not ask for permission before inserting clearly-marked test rows into dev data. Test rows must carry an obvious marker (e.g. `[smoke test]` in a text field, a caller number like `+1-555-SMOKE-TEST`, or a `RT-TEST-*` booking reference) so they are trivial to clean up afterwards, and you should offer cleanup once the user has confirmed the behaviour.

When acting against Supabase, prefer `apply_migration` for DDL (so it is captured in `supabase/migrations/`) and `execute_sql` for reads and for one-off test inserts. Never hardcode generated IDs from one migration into another.

**Auth URL config** (site URL, redirect allow list) is not exposed on the hosted MCP database tools. Run `npx tsx scripts/patch-supabase-auth-urls.ts` using `SUPABASE_ACCESS_TOKEN` or a `supabase login` token — do not send the user to the dashboard for this.

**Supabase MCP disconnected:** run `npm run supabase:mcp-reconnect` (writes `.cursor/mcp.json` from `SUPABASE_ACCESS_TOKEN` in `.env.local`). See `docs/ops/ENV.md`.

## Cursor Cloud specific instructions

This is a single Next.js 16 app (`cliste-dashboard`) — the control plane for the "Hello Cara" AI voice receptionist. The realtime voice worker (LiveKit/Twilio) lives in a separate repo; this app only serves the dashboard/admin/onboarding UI and the voice/stripe/cron webhooks. Standard commands live in `package.json` (`dev`, `build`, `lint`, `test`) and CI in `.github/workflows/ci.yml`; env vars are documented in `.env.example` and `docs/ops/ENV.md`. The Cloud startup script only runs `npm ci`; everything below (Supabase, dev server) is started on demand.

- **Dev server URL — use `http://localhost:3001`, not `127.0.0.1`.** `npm run dev` binds `0.0.0.0:3001`, but Next 16 blocks cross-origin dev resources (`/_next/webpack-hmr`) when the host is `127.0.0.1`, which breaks hydration so the animated pages render blank. Browsing via `localhost` is same-origin and works. (Alternatively a dev could add `allowedDevOrigins` to `next.config.ts`.)
- **`lint` currently reports pre-existing errors** (`npm run lint` exits non-zero). Typecheck (`npx tsc --noEmit`) and tests (`npm test`, node:test via tsx) are clean. `npm run build` needs placeholder Supabase env to be present — see how CI sets `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in `.github/workflows/ci.yml`.
- **The app needs Supabase to do anything real** (auth, dashboard, signup, admin). It boots without it (clients are lazy) but login/signup/dashboard require a database. Two options:
  - *Hosted (the team's documented path):* set `SUPABASE_ACCESS_TOKEN` (Cloud secret) then `npm run bootstrap:env` / `npm run reconnect:supabase` to write `.env.local` from the hosted project. Uses real dev data — mark test rows per the Supabase-access rules above.
  - *Local stack (self-contained, no secrets, no prod data):* requires Docker + the `supabase` CLI. See the local-Supabase gotcha below.
- **Local Supabase gotcha — `supabase start` cannot apply the migrations.** Several files in `supabase/migrations/` share the same numeric version prefix (e.g. two `002_*`, two `008_*`), which the CLI's migration tracker rejects with a duplicate-key error (the team applies migrations to the hosted project via the Supabase MCP, not the local CLI). To get a working local DB: temporarily set `[db.migrations] enabled = false` in `supabase/config.toml`, run `supabase start`, then apply the SQL directly, e.g. `for f in $(ls -1 supabase/migrations/*.sql | sort); do docker exec -i supabase_db_cliste-code-base-1 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f"; done`, and revert the config edit. Because the SQL is applied as `postgres` (not via the CLI runner), you must then grant the Supabase roles: `GRANT ... ON ALL TABLES/SEQUENCES IN SCHEMA public TO service_role` (and SELECT/INSERT/UPDATE/DELETE to `anon, authenticated`) plus matching `ALTER DEFAULT PRIVILEGES`, or the service-role client hits `permission denied`. Then point `.env.local` at `http://127.0.0.1:54321` with the local anon/service keys from `supabase status` and restart `npm run dev`. Local auth has email confirmation disabled, so dev signup auto-confirms and lands on `/onboarding`.
- **Restart `npm run dev` after changing `.env.local`** — Next does not hot-reload env changes.
