-- One-time backfill: reset corrupt agent_capture_fields from comma-split saves.
-- Structure becomes source of truth; agent_details_to_collect is derived text.

UPDATE public.organizations o
SET
  agent_capture_fields = CASE
    WHEN o.niche IN ('hair_salon', 'barber', 'beauty') THEN
      '[
        {"id":"name","label":"Name"},
        {"id":"phone","label":"Phone number"},
        {"id":"preferred_service","label":"Preferred service"},
        {"id":"preferred_day","label":"Preferred day"}
      ]'::jsonb
    ELSE
      '[
        {"id":"name","label":"Name"},
        {"id":"phone","label":"Phone number"},
        {"id":"what_they_need","label":"What they need"},
        {"id":"location","label":"Location"},
        {"id":"urgency","label":"Urgency"}
      ]'::jsonb
  END,
  agent_details_to_collect = CASE
    WHEN o.niche IN ('hair_salon', 'barber', 'beauty') THEN
      'name, phone number, preferred service, and preferred day.'
    ELSE
      'name, phone number, what they need, location, and urgency.'
  END,
  updated_at = now()
WHERE o.agent_capture_fields IS NOT NULL
  AND jsonb_typeof(o.agent_capture_fields) = 'array'
  AND (
    jsonb_array_length(o.agent_capture_fields) > 12
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(o.agent_capture_fields) AS elem
      WHERE lower(elem->>'label') LIKE 'and their%'
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(o.agent_capture_fields) AS elem
      WHERE elem->>'id' LIKE 'custom_and_%'
    )
    OR (
      SELECT count(*)::int
      FROM jsonb_array_elements(o.agent_capture_fields) AS elem
      WHERE lower(elem->>'label') LIKE '%name%'
    ) > 1
    OR (
      SELECT count(*)::int
      FROM jsonb_array_elements(o.agent_capture_fields) AS elem
      WHERE lower(elem->>'label') LIKE '%phone%'
    ) > 1
  );
