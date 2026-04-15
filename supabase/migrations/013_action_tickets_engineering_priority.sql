-- Distinguish routine human handoffs vs issues engineers should fix (training, tools, bugs).
alter table public.action_tickets
  add column if not exists engineering_priority text not null default 'none';

update public.action_tickets
set engineering_priority = 'none'
where engineering_priority is null;

alter table public.action_tickets
  add constraint action_tickets_engineering_priority_check
  check (engineering_priority in ('none', 'urgent'));

comment on column public.action_tickets.engineering_priority is
  'none: routine handoff (e.g. speak to named staff). urgent: knowledge gap, tool/system failure, or missing training data — platform team should review.';
