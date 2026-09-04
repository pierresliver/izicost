-- 016: open data inside the app + the community ticker. Both read only the anonymised pool. Safe to re-run.
-- The ticker scans the pool by date across all cities: give it an index that leads with the date.
create index if not exists price_points_date_city on public.price_points (observed_on desc, city) where city is not null;

-- A city's "staples table": median price of every product seen in the last 30 days, with spread and counts.
drop function if exists public.city_staples(text, text);
create function public.city_staples(p_city text, p_currency text default 'MZN')
returns table (product_key text, display_name text, size_value numeric, size_unit text, category text,
               median_price numeric, min_price numeric, max_price numeric, report_count int, store_count int,
               median_before numeric, change_pct numeric)
language sql stable security definer set search_path = public, extensions as $$
  with now30 as (
    select pp.product_id, round((percentile_cont(0.5) within group (order by pp.price))::numeric, 2) as med,
           min(pp.price) as mn, max(pp.price) as mx, count(*)::int as n, count(distinct pp.store_id)::int as stores
    from public.price_points pp
    where pp.city = p_city and pp.currency = upper(p_currency) and pp.observed_on >= current_date - 30
    group by pp.product_id
    having count(*) >= public.min_reports()
  ),
  before as (
    select pp.product_id, round((percentile_cont(0.5) within group (order by pp.price))::numeric, 2) as med
    from public.price_points pp
    where pp.city = p_city and pp.currency = upper(p_currency) and pp.observed_on >= current_date - 90 and pp.observed_on < current_date - 30
    group by pp.product_id
    having count(*) >= public.min_reports()   -- the "before" figure respects the same k-anonymity floor
  )
  select p.product_key, p.display_name, p.size_value, p.size_unit, p.category,
         n.med, n.mn, n.mx, n.n, n.stores, b.med,
         case when b.med > 0 then round(((n.med - b.med) / b.med * 100)::numeric, 1) end
  from now30 n
  join public.products p on p.id = n.product_id
  left join before b on b.product_id = n.product_id
  order by p.category, p.display_name;
$$;

-- The ticker: this week's biggest movers per city (median this week vs the 3 weeks before), plus activity.
drop function if exists public.community_ticker(int);
create function public.community_ticker(p_limit int default 12)
returns table (kind text, city text, display_name text, product_key text, change_pct numeric, price numeric, currency text, n int)
language sql stable security definer set search_path = public, extensions as $$
  with week as (
    select pp.city, pp.currency, pp.product_id, round((percentile_cont(0.5) within group (order by pp.price))::numeric, 2) as med, count(*)::int as n
    from public.price_points pp where pp.city is not null and pp.observed_on >= current_date - 7
    group by 1, 2, 3 having count(*) >= public.min_reports()
  ),
  before as (
    select pp.city, pp.currency, pp.product_id, round((percentile_cont(0.5) within group (order by pp.price))::numeric, 2) as med
    from public.price_points pp where pp.city is not null and pp.observed_on >= current_date - 28 and pp.observed_on < current_date - 7
    group by 1, 2, 3 having count(*) >= public.min_reports()
  ),
  movers as (
    select 'move'::text as kind, w.city, p.display_name, p.product_key, round(((w.med - b.med) / b.med * 100)::numeric, 1) as change_pct, w.med as price, w.currency, w.n
    from week w join before b using (city, currency, product_id) join public.products p on p.id = w.product_id
    where b.med > 0 and abs(w.med - b.med) / b.med >= 0.02
  ),
  activity as (
    select 'activity'::text as kind, pp.city, null::text as display_name, null::text as product_key, null::numeric as change_pct, null::numeric as price, null::text as currency, count(*)::int as n
    from public.price_points pp where pp.city is not null and pp.observed_on >= current_date
    group by pp.city
  )
  select * from (
    (select * from movers order by abs(change_pct) desc limit greatest(1, least(coalesce(p_limit, 12), 30)))
    union all
    (select * from activity order by n desc limit 4)
  ) x;
$$;

do $$ declare f text; begin
  foreach f in array array['city_staples(text, text)', 'community_ticker(int)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
