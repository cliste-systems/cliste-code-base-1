-- Replace customer-service with management; remove pharmacy and post-office slugs.

update public.action_tickets
set department_slug = 'management'
where department_slug = 'customer-service';

update public.action_tickets
set department_slug = 'general'
where department_slug in ('pharmacy', 'post-office');

alter table public.action_tickets
  drop constraint if exists action_tickets_department_slug_check;

alter table public.action_tickets
  add constraint action_tickets_department_slug_check
  check (
    department_slug in (
      'management',
      'meat-counter',
      'fish-counter',
      'deli',
      'bakery',
      'fruit-veg',
      'off-licence',
      'click-collect',
      'back-office',
      'general'
    )
  );
