-- Owner-facing title and Cara guidance for uploaded business files.

alter table public.business_files
  add column if not exists title text,
  add column if not exists cara_description text,
  add column if not exists when_to_use text;

comment on column public.business_files.title is
  'Display title chosen by the business (defaults from filename on upload).';

comment on column public.business_files.cara_description is
  'Plain-language summary for Cara: what this document contains.';

comment on column public.business_files.when_to_use is
  'When Cara should consult or mention this file on calls.';
