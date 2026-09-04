-- 020: tidy-ups from the security review of 018/019. Safe to re-run.
-- Trigger helper functions get the same explicit revoke as every other function (Postgres grants EXECUTE to
-- PUBLIC by default; they cannot be called directly anyway, but the allowlist should be literal).
do $$ declare f text; begin
  foreach f in array array['cap_receipt_items()', 'cap_receipts_per_day()', 'cap_shopping_list_items()', 'cap_shopping_lists()', 'receipt_item_to_price_point()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- A search radius has a ceiling (the app offers 2–25 km; a hand-made call cannot ask for the whole country).
create or replace function public.nearby_stores(p_lat double precision, p_lng double precision, p_km double precision default 10)
returns table (id uuid, name text, branch_address text, city text, store_type text, distance_km double precision)
language sql stable as $$
  select s.id, s.name, s.branch_address, s.city, s.store_type, d.km
  from public.stores s
  cross join lateral (
    select 2 * 6371 * asin(sqrt(
      power(sin(radians(s.lat - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - p_lng) / 2), 2))) as km
  ) d
  where s.lat is not null and s.lng is not null and d.km <= least(greatest(coalesce(p_km, 10), 0.5), 50)
  order by d.km
  limit 200;
$$;
revoke execute on function public.nearby_stores(double precision, double precision, double precision) from public, anon;
grant execute on function public.nearby_stores(double precision, double precision, double precision) to authenticated;
