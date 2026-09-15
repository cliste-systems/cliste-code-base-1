-- Allow dashboard staff to read abuse signals for their active organization.

create policy "caller_abuse_signals_select_active_org"
  on public.caller_abuse_signals
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());
