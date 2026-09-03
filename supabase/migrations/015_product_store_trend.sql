-- 015: per-store price history for one product ("how does each shop move its price?"). Weekly medians per
-- store over 180 days from the anonymised pool; respects min_reports() per week per store. Safe to re-run.
drop function if exists public.product_store_trend(text, text);
create function public.product_store_trend(p_key text, p_currency text)
returns table (store_id uuid, store_name text, city text, week_start date, median_price numeric, report_count int)
language sql stable security definer set search_path = public, extensions as $$
  select pp.store_id, s.name, coalesce(pp.city, s.city), date_trunc('week', pp.observed_on)::date as week_start,
         round((percentile_cont(0.5) within group (order by pp.price))::numeric, 2), count(*)::int
  from public.price_points pp
  join public.products p on p.id = pp.product_id
  join public.stores s on s.id = pp.store_id
  where p.product_key = p_key and pp.currency = upper(p_currency) and pp.store_id is not null
    and pp.observed_on >= current_date - 180
  group by pp.store_id, s.name, coalesce(pp.city, s.city), 4
  having count(*) >= public.min_reports()
  order by pp.store_id, 4;
$$;
revoke execute on function public.product_store_trend(text, text) from public, anon;
grant execute on function public.product_store_trend(text, text) to authenticated;
