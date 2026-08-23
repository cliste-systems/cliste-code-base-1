-- Transfer capability: extended phone system, department DDIs, call log transfer metadata.

alter table public.store_phone_systems
  add column if not exists model text,
  add column if not exists installer_name text,
  add column if not exists installer_contact text,
  add column if not exists trunk_provider text,
  add column if not exists has_ddi_range boolean,
  add column if not exists ddi_pattern text,
  add column if not exists transfer_verified_by uuid references auth.users (id) on delete set null,
  add column if not exists transfer_last_test_result text,
  add column if not exists transfer_verification_pending boolean not null default false;

comment on column public.store_phone_systems.installer_contact is
  'Internal installer contact — never compiled into caller-facing prompt.';
comment on column public.store_phone_systems.has_ddi_range is
  'null = not established; true = departments have direct-dial DDIs; false = extensions only.';
comment on column public.store_phone_systems.transfer_verification_pending is
  'Set when staff starts a test transfer; cleared when verification completes or fails.';

alter table public.store_departments
  add column if not exists direct_dial_e164 text;

comment on column public.store_departments.extension is
  'Internal PBX extension. Diagnostic only — NOT a transfer target. Not routable off-PBX.';
comment on column public.store_departments.direct_dial_e164 is
  'Department DDI. The only valid transfer target. Null means take a message.';

update public.store_departments
set direct_dial_e164 = phone_e164
where direct_dial_e164 is null
  and phone_e164 is not null
  and phone_e164 ~ '^\+[1-9][0-9]{6,14}$';

alter table public.call_logs
  add column if not exists transfer_department text,
  add column if not exists transfer_target text,
  add column if not exists transfer_connected boolean,
  add column if not exists verification_call boolean not null default false;

comment on column public.call_logs.transfer_connected is
  'true when caller reached a human on transfer; false on failed connect.';
comment on column public.call_logs.verification_call is
  'true when this call was a staff-initiated transfer verification test.';

-- Prevent generic writes from stamping verification fields (service role bypasses triggers).
create or replace function public.store_phone_systems_protect_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('cliste.allow_transfer_verification_write', true) = 'true' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.transfer_verified_at := old.transfer_verified_at;
    new.transfer_verified_by := old.transfer_verified_by;
    new.transfer_last_test_result := old.transfer_last_test_result;
    new.transfer_verification_pending := old.transfer_verification_pending;
  elsif tg_op = 'INSERT' then
    new.transfer_verified_at := null;
    new.transfer_verified_by := null;
    new.transfer_last_test_result := null;
    new.transfer_verification_pending := false;
  end if;
  return new;
end;
$$;

drop trigger if exists store_phone_systems_protect_verification on public.store_phone_systems;
create trigger store_phone_systems_protect_verification
  before insert or update on public.store_phone_systems
  for each row execute function public.store_phone_systems_protect_verification();

-- Verification field writes (bypass trigger via session GUC).
create or replace function public.invalidate_store_transfer_verification(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('cliste.allow_transfer_verification_write', 'true', true);
  update public.store_phone_systems
  set
    transfer_verified_at = null,
    transfer_verified_by = null,
    transfer_last_test_result = null,
    transfer_verification_pending = false,
    updated_at = now()
  where organization_id = p_org_id;
end;
$$;

create or replace function public.set_store_transfer_verification_pending(
  p_org_id uuid,
  p_pending boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('cliste.allow_transfer_verification_write', 'true', true);
  update public.store_phone_systems
  set
    transfer_verification_pending = p_pending,
    updated_at = now()
  where organization_id = p_org_id;
end;
$$;

create or replace function public.stamp_store_transfer_verified(
  p_org_id uuid,
  p_result text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('cliste.allow_transfer_verification_write', 'true', true);
  update public.store_phone_systems
  set
    transfer_verified_at = now(),
    transfer_verified_by = null,
    transfer_last_test_result = left(coalesce(p_result, ''), 500),
    transfer_verification_pending = false,
    updated_at = now()
  where organization_id = p_org_id;
end;
$$;
