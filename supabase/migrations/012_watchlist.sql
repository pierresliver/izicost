-- 012: "My items" price watch (PS, 2026-09-03). A per-user list of products, filled automatically from
-- the things they buy often (+ anything they pin), with the cheapest current community price, how it moved
-- against what they last paid (or the community median before), an 8-week sparkline and a bell for drops.
-- Everything a watch row reveals comes from the caller's OWN receipts or the anonymised price pool.
-- Safe to re-run.

create table if not exists public.watch_items (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  product_id           uuid not null references public.products (id) on delete cascade,
  currency             text not null default 'MZN' check (currency ~ '^[A-Z]{3}$'),
  notify               boolean not null default true,
  source               text not null default 'pinned' check (source in ('auto', 'pinned')),
  hidden               boolean not null default false,   -- removed by the user: never auto-added again
  last_notified_price  numeric(14,2),
  last_notified_at     timestamptz,
  created_at           timestamptz not null default now(),
  unique (user_id, product_id, currency)
);
create index if not exists watch_items_user on public.watch_items (user_id, hidden, created_at);
alter table public.watch_items enable row level security;
drop policy if exists "own watch items" on public.watch_items;
create policy "own watch items" on public.watch_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.watch_items from anon, authenticated;
grant select, insert, update, delete on public.watch_items to authenticated;

-- Products the caller buys often (>= 2 receipts in 180 days, groceries only) become "auto" watch rows.
-- Idempotent; rows the user hid are not re-added (the unique key + the NOT EXISTS see them).
create or replace function public.watchlist_autofill(p_limit int default 8) returns int
language plpgsql volatile security definer set search_path = public, extensions as $$
declare n int;
begin
  if auth.uid() is null then return 0; end if;
  with freq as (
    select p.id as product_id, upper(r.currency) as currency, count(*) as c, max(r.purchased_on) as last_on
    from public.receipt_items ri
    join public.receipts r on r.id = ri.receipt_id
    join public.products p on p.product_key = public.product_key_clean(coalesce(nullif(trim(ri.product_name), ''), ri.name_as_printed))
    where ri.user_id = auth.uid() and r.user_id = auth.uid()
      and r.currency is not null and r.purchased_on >= current_date - 180
      and coalesce(ri.category, 'other') not in ('restaurant', 'parking', 'utilities', 'services', 'transport', 'other')
    group by 1, 2
    having count(*) >= 2
    order by c desc, last_on desc
    limit greatest(0, least(coalesce(p_limit, 8), 20))
  )
  insert into public.watch_items (user_id, product_id, currency, source)
  select auth.uid(), f.product_id, f.currency, 'auto'
  from freq f
  where not exists (select 1 from public.watch_items w where w.user_id = auth.uid() and w.product_id = f.product_id and w.currency = f.currency)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Everything the card needs in one call.
drop function if exists public.watchlist_overview();
create function public.watchlist_overview()
returns table (
  watch_id uuid, product_id uuid, product_key text, display_name text, size_value numeric, size_unit text,
  currency text, notify boolean, source text,
  best_price numeric, best_store text, best_city text, best_on date, best_reports int, best_point bigint,
  min_60 numeric, median_recent numeric, median_before numeric,
  my_last_price numeric, my_last_on date, my_last_store text,
  last_notified_price numeric, spark jsonb)
language sql stable security definer set search_path = public, extensions as $$
  with w as (
    select * from public.watch_items where user_id = auth.uid() and not hidden
  ),
  pp as (  -- the pool rows we care about, once
    select pp.product_id, pp.currency, pp.price, pp.observed_on
    from public.price_points pp join w on w.product_id = pp.product_id and w.currency = pp.currency
    where pp.observed_on >= current_date - 60
  ),
  best as (
    select distinct on (c.product_id, c.currency)
           c.product_id, c.currency, c.price, c.store_name, c.city, c.observed_on, c.report_count, c.price_point_id
    from public.community_prices c join w on w.product_id = c.product_id and w.currency = c.currency
    order by c.product_id, c.currency, c.price asc, c.observed_on desc
  ),
  recent as (
    select product_id, currency, round((percentile_cont(0.5) within group (order by price))::numeric, 2) as med
    from pp where observed_on >= current_date - 14 group by 1, 2
  ),
  before as (
    select product_id, currency, round((percentile_cont(0.5) within group (order by price))::numeric, 2) as med
    from pp where observed_on < current_date - 14 group by 1, 2
  ),
  low as (
    select product_id, currency, min(price) as mn from pp group by 1, 2
  ),
  spark as (
    select product_id, currency, jsonb_agg(med order by wk) as pts
    from (
      select product_id, currency, date_trunc('week', observed_on)::date as wk,
             round((percentile_cont(0.5) within group (order by price))::numeric, 2) as med
      from pp where observed_on >= current_date - 56 group by 1, 2, 3
    ) s group by 1, 2
  ),
  mine as (
    select distinct on (p.id, upper(r.currency))
           p.id as product_id, upper(r.currency) as currency,
           coalesce(ri.unit_price, case when ri.qty > 0 then ri.line_total / ri.qty end) as price, r.purchased_on, r.store_name
    from public.receipt_items ri
    join public.receipts r on r.id = ri.receipt_id
    join public.products p on p.product_key = public.product_key_clean(coalesce(nullif(trim(ri.product_name), ''), ri.name_as_printed))
    join w on w.product_id = p.id
    where ri.user_id = auth.uid() and r.user_id = auth.uid()
    order by p.id, upper(r.currency), r.purchased_on desc, ri.created_at desc
  )
  select w.id, w.product_id, p.product_key, p.display_name, p.size_value, p.size_unit, w.currency, w.notify, w.source,
         b.price, b.store_name, b.city, b.observed_on, b.report_count, b.price_point_id,
         l.mn, rc.med, bf.med,
         round(m.price::numeric, 2), m.purchased_on, m.store_name,
         w.last_notified_price, coalesce(sp.pts, '[]'::jsonb)
  from w
  join public.products p on p.id = w.product_id
  left join best   b  on b.product_id = w.product_id and b.currency = w.currency
  left join recent rc on rc.product_id = w.product_id and rc.currency = w.currency
  left join before bf on bf.product_id = w.product_id and bf.currency = w.currency
  left join low    l  on l.product_id = w.product_id and l.currency = w.currency
  left join spark  sp on sp.product_id = w.product_id and sp.currency = w.currency
  left join mine   m  on m.product_id = w.product_id and m.currency = w.currency
  order by (w.source = 'pinned') desc, w.created_at;
$$;

do $$ declare f text; begin
  foreach f in array array['watchlist_autofill(int)', 'watchlist_overview()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
