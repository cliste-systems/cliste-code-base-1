create table if not exists public.admin_email_attachment_scans (
  id uuid primary key default gen_random_uuid(),
  resend_email_id text not null,
  attachment_id text not null,
  filename text not null,
  content_type text,
  size_bytes bigint,
  scan_status text not null default 'pending'
    check (scan_status in ('pending','clean','infected','failed','unsupported')),
  scanner text,
  scanner_reference text,
  scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resend_email_id, attachment_id)
);

comment on table public.admin_email_attachment_scans is
  'Quarantine and malware-scan state for internal admin email attachments. Files must never be previewed or downloaded unless scan_status is clean and the server-side attachment allowlist also passes.';

create index if not exists admin_email_attachment_scans_email_idx
  on public.admin_email_attachment_scans (resend_email_id, created_at asc);

alter table public.admin_email_attachment_scans enable row level security;
revoke all on table public.admin_email_attachment_scans from anon, authenticated;
grant select, insert, update, delete on table public.admin_email_attachment_scans to service_role;
