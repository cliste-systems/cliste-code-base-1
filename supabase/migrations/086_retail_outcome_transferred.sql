-- Document transferred as a canonical call_logs.outcome value (free text column).
-- No enum constraint — normalization lives in src/lib/call-history-types.ts.

comment on column public.call_logs.outcome is
  'Canonical v1 values: answered, link_sent, callback_requested, action_created, transferred, failed, voicemail_or_no_speech, spam_or_abuse, blocked. Free text is normalized on read.';

-- Optional backfill hint (run manually if needed):
-- update public.call_logs set outcome = 'transferred'
-- where lower(outcome) in ('transfer', 'transferred')
--    or lower(coalesce(ai_summary, '')) like '%transfer%';
