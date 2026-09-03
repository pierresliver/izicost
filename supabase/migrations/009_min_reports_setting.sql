-- 009: how many reports a product/store needs before its price is shown to the community.
-- Was hard-coded to 2 (k-anonymity). PS decision 2026-09-03: show from the FIRST report while the pool is
-- small (a bargain with one option is still a bargain); the app shows the report count so users can judge.
-- Change back with:  update public.community_settings set value = '2' where key = 'min_reports';
-- Safe to re-run.
create table if not exists public.community_settings (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.community_settings enable row level security;
revoke all on public.community_settings from anon, authenticated; -- read only through min_reports()
insert into public.community_settings (key, value) values ('min_reports', '1')
  on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function public.min_reports() returns int
language sql stable security definer set search_path = public as $$
  select greatest(1, coalesce((select value::int from public.community_settings where key = 'min_reports'), 2));
$$;
revoke execute on function public.min_reports() from public, anon;
grant execute on function public.min_reports() to authenticated;

-- Recreate the view with the setting instead of the literal 2 (same columns, same owner semantics).
drop function if exists public.product_prices(text);  -- depends on the view type
drop view if exists public.community_prices;
create view public.community_prices as
with recent as (
  select * from public.price_points where observed_on >= current_date - 60
),
agg as (
  select product_id, store_id, currency,
         count(*)::int as report_count,
         round((percentile_cont(0.5) within group (order by price))::numeric, 2) as median_price,
         min(price) as min_price
  from recent
  where store_id is not null
  group by product_id, store_id, currency
  having count(*) >= public.min_reports()
),
latest as (
  select distinct on (product_id, store_id, currency)
         product_id, store_id, currency, price, unit_price, observed_on, city, country, id as price_point_id
  from recent
  where store_id is not null
  order by product_id, store_id, currency, observed_on desc, id desc
)
select l.product_id, p.product_key, p.display_name, p.size_value, p.size_unit, p.category,
       l.store_id, s.name as store_name, s.branch_address, s.store_type,
       coalesce(l.city, s.city) as city, coalesce(l.country, s.country) as country,
       l.currency, l.price, l.unit_price, a.median_price, a.min_price, l.observed_on, a.report_count, l.price_point_id
from latest l
join agg a using (product_id, store_id, currency)
join public.products p on p.id = l.product_id
join public.stores s on s.id = l.store_id;
grant select on public.community_prices to authenticated;

create or replace function public.product_prices(p_key text)
returns setof public.community_prices
language sql stable as $$
  select * from public.community_prices where product_key = p_key order by currency, price asc, observed_on desc;
$$;
revoke execute on function public.product_prices(text) from public, anon;
grant execute on function public.product_prices(text) to authenticated;

-- 90-day trend: weeks with at least min_reports() reports.
create or replace function public.product_trend(p_key text, p_currency text, p_city text default null)
returns table (week_start date, min_price numeric, median_price numeric, report_count int)
language sql stable security definer set search_path = public, extensions as $$
  select date_trunc('week', pp.observed_on)::date as week_start,
         min(pp.price), round((percentile_cont(0.5) within group (order by pp.price))::numeric, 2), count(*)::int
  from public.price_points pp
  join public.products p on p.id = pp.product_id
  where p.product_key = p_key and pp.currency = p_currency
    and pp.observed_on >= current_date - 90
    and (p_city is null or pp.city = p_city)
  group by 1 having count(*) >= public.min_reports()
  order by 1;
$$;
