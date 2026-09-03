-- 014: community price index per city ("Maputo got 4% pricier this month"). Built only from the anonymised
-- price pool: for every product seen in a city in two consecutive months, the ratio of its monthly median
-- prices; a city's monthly change is the median of those ratios (robust to one odd receipt), chained into
-- an index with base 100 at the first month. A month needs >= 3 products with a pair to count. Safe to re-run.
drop function if exists public.city_price_index(int);
create function public.city_price_index(p_months int default 6)
returns table (city text, country text, currency text, month date, index numeric, change_pct numeric, products int)
language sql stable security definer set search_path = public, extensions as $$
  with pts as (
    select pp.city, pp.country, pp.currency, pp.product_id, date_trunc('month', pp.observed_on)::date as m,
           percentile_cont(0.5) within group (order by pp.price) as med
    from public.price_points pp
    where pp.city is not null and pp.price > 0
      and pp.observed_on >= (date_trunc('month', current_date) - make_interval(months => greatest(1, least(coalesce(p_months, 6), 24))))::date
    group by 1, 2, 3, 4, 5
  ),
  pairs as (
    select a.city, a.country, a.currency, a.m, a.med / b.med as ratio
    from pts a
    join pts b on b.city = a.city and b.currency = a.currency and b.product_id = a.product_id
              and b.m = (a.m - interval '1 month')::date
    where b.med > 0
  ),
  monthly as (
    select city, country, currency, m, percentile_cont(0.5) within group (order by ratio) as r, count(*)::int as n
    from pairs group by 1, 2, 3, 4
    having count(*) >= 3
  )
  select city, country, currency, m as month,
         round((exp(sum(ln(r)) over (partition by city, currency order by m)) * 100)::numeric, 1) as index,
         round(((r - 1) * 100)::numeric, 1) as change_pct,
         n as products
  from monthly
  order by city, currency, m;
$$;
revoke execute on function public.city_price_index(int) from public, anon;
grant execute on function public.city_price_index(int) to authenticated;
