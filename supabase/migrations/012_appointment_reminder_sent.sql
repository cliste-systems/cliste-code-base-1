-- One SMS per appointment: 24h reminder sent via Twilio cron (see /api/cron/appointment-reminders).
alter table public.appointments
  add column if not exists reminder_sent_at timestamptz;

comment on column public.appointments.reminder_sent_at is
  'Set when the customer received the automated 24h-before SMS; null means not sent yet.';

create index if not exists appointments_reminder_due_idx
  on public.appointments (status, reminder_sent_at, start_time)
  where status = 'confirmed' and reminder_sent_at is null;
