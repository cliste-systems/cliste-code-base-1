-- Persistent retail call regression lab for founder/admin QA.
-- Service-role only: these tables are not exposed to tenant clients.

create table if not exists public.retail_regression_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  title text not null,
  category text not null,
  tags text[] not null default '{}',
  turns jsonb not null default '[]'::jsonb,
  expectations jsonb not null default '{}'::jsonb,
  source text not null default 'built_in'
    check (source in ('built_in', 'manual', 'variant')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.retail_regression_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  called_number text not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'cancelled', 'error')),
  total integer not null default 0,
  passed integer not null default 0,
  failed integer not null default 0,
  errored integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.retail_regression_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.retail_regression_runs(id) on delete cascade,
  scenario_id uuid not null references public.retail_regression_scenarios(id) on delete cascade,
  status text not null
    check (status in ('pass', 'fail', 'error')),
  reasons text[] not null default '{}',
  failure_signature text,
  issue_kind text
    check (issue_kind is null or issue_kind in ('new_failure', 'recurring', 'regression_returned')),
  occurrence_count integer not null default 0,
  duration_ms integer,
  transcript jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  assistant_text text,
  created_at timestamptz not null default now(),
  unique (run_id, scenario_id)
);

create index if not exists retail_regression_scenarios_org_active_idx
  on public.retail_regression_scenarios (organization_id, active, category);

create index if not exists retail_regression_runs_org_started_idx
  on public.retail_regression_runs (organization_id, started_at desc);

create index if not exists retail_regression_results_scenario_created_idx
  on public.retail_regression_results (scenario_id, created_at desc);

create index if not exists retail_regression_results_failure_signature_idx
  on public.retail_regression_results (scenario_id, failure_signature, created_at desc)
  where failure_signature is not null;

alter table public.retail_regression_scenarios enable row level security;
alter table public.retail_regression_runs enable row level security;
alter table public.retail_regression_results enable row level security;

comment on table public.retail_regression_scenarios is
  'Admin-only persistent retail call regression scenarios. Executed through text rehearsal.';
comment on table public.retail_regression_runs is
  'Admin-only regression suite run summaries.';
comment on table public.retail_regression_results is
  'Per-scenario regression results with recurring failure memory.';
