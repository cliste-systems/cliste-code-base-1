-- Reclassify open tickets so department workspaces and badges match live demo routing.

update public.action_tickets
set department_slug = 'management'
where status = 'open'
  and department_slug = 'general'
  and summary ~* '(manager|complaint|unhappy|refund|real rewards|applegreen|speak to)';

update public.action_tickets
set department_slug = 'meat-counter'
where status = 'open'
  and department_slug = 'general'
  and summary ~* '(butcher|meat counter|steak|striploin|rashers|sausage|sirloin)';

update public.action_tickets
set department_slug = 'bakery'
where status = 'open'
  and department_slug = 'general'
  and summary ~* '(birthday cake|bakery|retail-bakery-cake|\bcake order\b)';

update public.action_tickets
set brief_summary = left(
  trim(regexp_replace(summary, E'\\s*\\[route:[^\\]]+\\]\\s*$', '', 'i')),
  120
)
where brief_summary is null
  and coalesce(trim(summary), '') <> '';
