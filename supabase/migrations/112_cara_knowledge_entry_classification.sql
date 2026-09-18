-- Multi-department and topic labels for Cara knowledge browsing (dashboard-only metadata).

alter table public.cara_knowledge_folder_assignments
  add column if not exists department_ids text[] not null default '{}',
  add column if not exists topic_labels text[] not null default '{}';

comment on column public.cara_knowledge_folder_assignments.department_ids is
  'Stable department folder ids when an entry relates to one or more departments.';

comment on column public.cara_knowledge_folder_assignments.topic_labels is
  'Optional general-store topic labels (facilities, hours, parking, etc.).';
