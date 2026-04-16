-- Optional customer email for SendGrid confirmations and 24h reminders.

alter table public.appointments
  add column if not exists customer_email text;

alter table public.appointments
  add column if not exists confirmation_email_sent_at timestamptz;

alter table public.appointments
  add column if not exists reminder_email_sent_at timestamptz;

comment on column public.appointments.customer_email is
  'Optional. Used for booking confirmation and reminder emails (SendGrid).';

comment on column public.appointments.confirmation_email_sent_at is
  'Set when a confirmation email was sent successfully.';

comment on column public.appointments.reminder_email_sent_at is
  'Set when the ~24h reminder email was sent (cron).';

create index if not exists appointments_reminder_email_due_idx
  on public.appointments (status, reminder_email_sent_at, start_time)
  where customer_email is not null;
