-- 029: the live ticker can be limited to one city (Home shows "near me" = my city, or all cities). Safe to re-run.
drop function if exists public.community_ticker(int);
create or replace function public.community_ticker(p_limit int default 12, p_city text default null)
returns table (kind text, city text, display_name text, product_key text, change_pct numeric, price numeric, currency text, n int)
language sql stable security definer set search_path = public, extensions as $$
  with week as (
    select pp.city, pp.currency, pp.product_id, round((percentile_cont(0.5) within group (order by pp.price))::numeric, 2) as med, count(*)::int as n
    from public.price_points pp where pp.city is not null and (p_city is null or pp.city = p_city) and pp.observed_on >= current_date - 7
    group by 1, 2, 3 having count(*) >= public.min_reports()
  ),
  before as (
    select pp.city, pp.currency, pp.product_id, round((percentile_cont(0.5) within group (order by pp.price))::numeric, 2) as med
    from public.price_points pp where pp.city is not null and (p_city is null or pp.city = p_city) and pp.observed_on >= current_date - 28 and pp.observed_on < current_date - 7
    group by 1, 2, 3 having count(*) >= public.min_reports()
  ),
  movers as (
    select 'move'::text as kind, w.city, p.display_name, p.product_key, round(((w.med - b.med) / b.med * 100)::numeric, 1) as change_pct, w.med as price, w.currency, w.n
    from week w join before b using (city, currency, product_id) join public.products p on p.id = w.product_id
    where b.med > 0 and abs(w.med - b.med) / b.med >= 0.02
  ),
  activity as (
    select 'activity'::text as kind, pp.city, null::text as display_name, null::text as product_key, null::numeric as change_pct, null::numeric as price, null::text as currency, count(*)::int as n
    from public.price_points pp where pp.city is not null and (p_city is null or pp.city = p_city) and pp.observed_on >= current_date
    group by pp.city having count(*) >= public.min_reports()   -- same k-anonymity floor as every other community read
  )
  select * from (
    (select * from movers order by abs(change_pct) desc limit greatest(1, least(coalesce(p_limit, 12), 30)))
    union all
    (select * from activity order by n desc limit 4)
  ) x;
$$;
revoke execute on function public.community_ticker(int, text) from public, anon;
grant execute on function public.community_ticker(int, text) to authenticated;
