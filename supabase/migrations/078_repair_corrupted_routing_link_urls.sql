-- Repair routing_links rows where link routes stored capture prose instead of URLs.
-- Inbox/callback rows may legitimately store capture text in `url`.

create or replace function public.repair_corrupted_routing_links(links jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  elem jsonb;
  result jsonb := '[]'::jsonb;
  target text;
  preset text;
  url_text text;
  captured_prose text := null;
  fallback_idx int := -1;
  idx int := 0;
  existing_url text;
begin
  if links is null or jsonb_typeof(links) <> 'array' then
    return coalesce(links, '[]'::jsonb);
  end if;

  for elem in select value from jsonb_array_elements(links)
  loop
    target := coalesce(elem->>'targetType', 'link');
    preset := coalesce(elem->>'presetId', '');
    url_text := trim(coalesce(elem->>'url', ''));

    if (
      (target = 'link' or preset in ('booking-inquiry', 'form-application'))
      and url_text <> ''
      and url_text !~* '^https?://'
      and url_text !~* '^mailto:'
      and url_text !~* '^tel:'
      and url_text <> 'transfer'
    ) then
      if captured_prose is null and (
        url_text like '%,%'
        or url_text ~* '\m(name|phone|number|email|service|appointment|preferred)\M'
      ) then
        captured_prose := url_text;
      end if;
      elem := jsonb_set(elem, '{url}', '""'::jsonb);
    end if;

    if preset in ('anything-else', 'general') then
      fallback_idx := idx;
    end if;

    result := result || jsonb_build_array(elem);
    idx := idx + 1;
  end loop;

  if captured_prose is not null and fallback_idx >= 0 then
    elem := result->fallback_idx;
    existing_url := trim(coalesce(elem->>'url', ''));
    if existing_url = '' or existing_url = 'Take a message for the team' then
      elem := jsonb_set(elem, '{url}', to_jsonb(captured_prose));
      result := jsonb_set(result, array[fallback_idx::text]::text[], elem, false);
    end if;
  end if;

  return result;
end;
$$;

update public.organizations
set routing_links = public.repair_corrupted_routing_links(routing_links),
    updated_at = now()
where routing_links is not null
  and jsonb_typeof(routing_links) = 'array'
  and routing_links::text <> public.repair_corrupted_routing_links(routing_links)::text;

comment on function public.repair_corrupted_routing_links(jsonb) is
  'Clears non-HTTP urls from link-type routing rows; moves capture prose to fallback inbox note when needed.';
