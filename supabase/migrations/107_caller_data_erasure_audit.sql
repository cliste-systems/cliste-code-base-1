-- Audit trail when caller PII is erased from call logs (GDPR Art. 17).
-- Rows stay in the call log; content is redacted and metadata records who/when/why.

alter table public.call_logs
  add column if not exists caller_data_erased_at timestamptz,
  add column if not exists caller_data_erased_by uuid references auth.users (id) on delete set null,
  add column if not exists caller_data_erased_by_label text,
  add column if not exists caller_data_erased_reason text;

comment on column public.call_logs.caller_data_erased_at is
  'When caller PII on this row was erased via dashboard GDPR tools.';
comment on column public.call_logs.caller_data_erased_by is
  'Dashboard user who performed the erasure.';
comment on column public.call_logs.caller_data_erased_by_label is
  'Display name or email of the staff member at time of erasure.';
comment on column public.call_logs.caller_data_erased_reason is
  'Operator-provided reason for the erasure request.';

create index if not exists call_logs_caller_data_erased_at_idx
  on public.call_logs (organization_id, caller_data_erased_at desc)
  where caller_data_erased_at is not null;
