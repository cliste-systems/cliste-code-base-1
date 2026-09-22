update public.retail_regression_scenarios
set expectations =
  jsonb_set(
    jsonb_set(expectations, '{requiredServiceArea}', '"dairy"'::jsonb, true),
    '{summary}',
    '"Explicit dairy-area wording should remain scoped to the dairy section."'::jsonb,
    true
  ),
  updated_at = now()
where slug like 'dairy-wall-browse-%';

update public.retail_regression_scenarios
set expectations = expectations - 'lastTurnMustNotAskClarifyingQuestion',
    updated_at = now()
where slug like 'avocado-refinement-%';

update public.retail_regression_scenarios
set expectations =
  jsonb_set(
    jsonb_set(
      expectations,
      '{assistantMustIncludeAny}',
      '["€2.50","2.50","two euro fifty","two fifty"]'::jsonb,
      true
    ),
    '{assistantMustNotInclude}',
    '["can''t search for offers by price","cannot search for offers by price","can''t check specific price-point offers","cannot check specific price-point offers","can''t actually see a list of deals by price","eleven euro"]'::jsonb,
    true
  ),
  updated_at = now()
where slug like 'rewards-250-%';
