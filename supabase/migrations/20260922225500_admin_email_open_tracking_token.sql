alter table public.admin_email_messages
  add column if not exists open_tracking_token uuid;

create unique index if not exists admin_email_messages_open_tracking_token_idx
  on public.admin_email_messages (open_tracking_token)
  where open_tracking_token is not null;
