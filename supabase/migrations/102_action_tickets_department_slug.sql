-- Route Action Inbox tickets to retail department workspaces.

alter table public.action_tickets
  add column if not exists department_slug text not null default 'general'
    check (
      department_slug in (
        'customer-service',
        'meat-counter',
        'fish-counter',
        'deli',
        'bakery',
        'fruit-veg',
        'off-licence',
        'click-collect',
        'post-office',
        'pharmacy',
        'back-office',
        'general'
      )
    );

alter table public.action_tickets
  add column if not exists brief_summary text;

comment on column public.action_tickets.department_slug is
  'Retail department workspace slug for dashboard routing (fixed pack per store).';

comment on column public.action_tickets.brief_summary is
  'One-line triage preview for Action Inbox and department lists.';

create index if not exists action_tickets_org_dept_status_created_idx
  on public.action_tickets (organization_id, department_slug, status, created_at desc);

-- Best-effort backfill for open tickets (keyword rules mirror classifyActionDepartment).
update public.action_tickets
set department_slug = 'bakery'
where department_slug = 'general'
  and summary ~* '\[route:\s*retail-bakery-cake\]';

update public.action_tickets
set department_slug = 'deli'
where department_slug = 'general'
  and summary ~* '(corned beef|\bdeli\b|sliced ham|charcuterie|crumbed ham)';

update public.action_tickets
set department_slug = 'meat-counter'
where department_slug = 'general'
  and summary ~* '(meat counter|butcher|steak|striploin|rashers|\bsausage\b)';

update public.action_tickets
set department_slug = 'fish-counter'
where department_slug = 'general'
  and summary ~* '(fish counter|salmon|seafood|fishmonger|\bcod\b|\bhaddock\b)';

update public.action_tickets
set department_slug = 'off-licence'
where department_slug = 'general'
  and summary ~* '(off[- ]licence|\bwine\b|\bbeer\b|\bspirits\b|\bcider\b)';

update public.action_tickets
set department_slug = 'fruit-veg'
where department_slug = 'general'
  and summary ~* '(\bfruit\b|\bvegetable\b|\bproduce\b|\bveg counter\b)';

update public.action_tickets
set department_slug = 'click-collect'
where department_slug = 'general'
  and summary ~* '(click.?collect|online order pickup)';

update public.action_tickets
set department_slug = 'pharmacy'
where department_slug = 'general'
  and summary ~* '\bpharmacy\b';

update public.action_tickets
set department_slug = 'post-office'
where department_slug = 'general'
  and summary ~* '(post office|an post|\bparcel\b)';

update public.action_tickets
set brief_summary = left(
  trim(regexp_replace(summary, '\s*\[route:[^\]]+\]\s*$', '', 'i')),
  120
)
where brief_summary is null
  and coalesce(trim(summary), '') <> '';
