-- Track how often callers ask about the same open knowledge gap.

alter table public.cara_training_items
  add column if not exists occurrence_count int not null default 1,
  add column if not exists last_seen_at timestamptz not null default now();

comment on column public.cara_training_items.occurrence_count is
  'How many calls surfaced this open gap (deduped by normalized topic).';
comment on column public.cara_training_items.last_seen_at is
  'Most recent call that matched this open gap topic.';
