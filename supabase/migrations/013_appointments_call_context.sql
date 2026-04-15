-- Link to the call that produced the booking; notes from AI; confirmation SMS time.
-- Reminder SMS uses reminder_sent_at (see 012_appointment_reminder_sent.sql + cron).
alter table public.appointments
  add column if not exists call_log_id uuid references public.call_logs (id) on delete set null;

alter table public.appointments
  add column if not exists ai_booking_notes text;

alter table public.appointments
  add column if not exists confirmation_sms_sent_at timestamptz;

create index if not exists appointments_call_log_id_idx
  on public.appointments (call_log_id)
  where call_log_id is not null;

comment on column public.appointments.call_log_id is
  'Call log row when the booking was created or captured by the AI receptionist.';
comment on column public.appointments.ai_booking_notes is
  'Notes captured or updated by the AI (e.g. allergies, preferences).';
comment on column public.appointments.confirmation_sms_sent_at is
  'When the booking confirmation SMS was sent to the client.';
