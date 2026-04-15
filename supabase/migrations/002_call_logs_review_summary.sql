-- Salon-friendly corrected transcript + AI summary for call history UI
alter table public.call_logs
  add column if not exists transcript_review text;

alter table public.call_logs
  add column if not exists ai_summary text;
