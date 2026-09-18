-- Persist full knowledge classification chosen during Teach Cara / Needs your input.

alter table public.cara_training_items
  add column if not exists knowledge_department_ids text[] not null default '{}'::text[],
  add column if not exists knowledge_topic_labels text[] not null default '{}'::text[];

comment on column public.cara_training_items.knowledge_department_ids is
  'Department folder ids chosen when this training item is applied.';

comment on column public.cara_training_items.knowledge_topic_labels is
  'General knowledge topic labels chosen when this training item is applied.';
