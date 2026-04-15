-- How the appointment was created (for analytics on the dashboard).
alter table public.appointments
  add column source text not null default 'dashboard';

alter table public.appointments
  add constraint appointments_source_check check (
    source in ('booking_link', 'ai_call', 'dashboard')
  );

comment on column public.appointments.source is
  'booking_link: public storefront; ai_call: AI receptionist; dashboard: staff in salon dashboard';
