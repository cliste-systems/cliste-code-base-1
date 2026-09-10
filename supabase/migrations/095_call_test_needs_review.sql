-- Flag test calls that failed transcript QA and need human review.

alter table public.call_test_reports
  add column if not exists needs_review boolean not null default false;

create index if not exists call_test_reports_needs_review_idx
  on public.call_test_reports (needs_review, created_at desc)
  where needs_review = true;
