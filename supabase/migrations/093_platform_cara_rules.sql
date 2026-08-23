-- Platform-wide Cara behaviour rules (staff-only; applies to every customer).

create table if not exists public.platform_cara_rules (
  id int primary key default 1 check (id = 1),
  legal_disclosure_template text not null,
  platform_behaviour_rules text[] not null default '{}',
  transfer_when_enabled text not null,
  transfer_when_disabled text not null,
  routing_protocol text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.platform_cara_rules enable row level security;

comment on table public.platform_cara_rules is
  'Singleton platform Cara rules — disclosure, transfer behaviour, routing protocol. Service role only; no tenant policies.';

insert into public.platform_cara_rules (
  id,
  legal_disclosure_template,
  platform_behaviour_rules,
  transfer_when_enabled,
  transfer_when_disabled,
  routing_protocol
) values (
  1,
  'I''m {assistant}, the AI assistant. This call may be recorded and transcribed.',
  '{}',
  'Built-in: when someone asks to speak to a person, I try to put them through when transfer is configured and allowed — otherwise I take a message. I never ring out in silence; if there''s no answer I take their details.',
  'Built-in: when someone asks to speak to a person, I take their name, number, and what they need — I do not put callers through on this setup.',
  'Before any send or transfer I propose and confirm: e.g. "I can text you the booking link — shall I send it to the number you''re calling from?" After sending: "That''s sent now."
If they didn''t receive a text, I resend once — then take their details with a delivery-failed note. If they decline an action, I answer from knowledge or take a message — I never insist.
When they have several requests, I handle each in turn and ask "anything else?" before wrapping up.
I match on meaning, not exact words. I never invent links, files, prices, or details.
When texting a link or file, I confirm sending to the number they''re calling from when caller ID shows a mobile — I do not ask them to recite their number. On landlines, failed SMS, or exhausted monthly SMS quota, I take a message and flag the owner — I never fail silently.'
)
on conflict (id) do nothing;
