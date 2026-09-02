-- IziCost — Phase 4: shopping basket (private), basket quote and price-alert checks.
-- Depends on: schema.sql (stores), 003_community_prices.sql (products, community_prices, price_alerts).
-- Safe to run more than once.
--
-- Privacy: shopping lists are private (RLS, own rows). basket_quote and check_price_alerts run as the
-- caller (security invoker): they read the caller's own list / alerts and the anonymised community view.

create extension if not exists pgcrypto;

-- ── 1. Shopping lists (private) ────────────────────────────────────────────────
create table if not exists public.shopping_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null default 'My basket',
  created_at timestamptz not null default now()
);
create index if not exists shopping_lists_user on public.shopping_lists (user_id, created_at);

create table if not exists public.shopping_list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.shopping_lists (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name       text not null check (length(trim(name)) between 1 and 120),
  qty        numeric(12,3) not null default 1 check (qty > 0),
  checked    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shopping_list_items_list on public.shopping_list_items (list_id, created_at);

-- ── 2. Alert hits: one row per alert once the user has been shown it (no double nagging) ──
create table if not exists public.price_alert_hits (
  alert_id    uuid primary key references public.price_alerts (id) on delete cascade,
  notified_at timestamptz not null default now()
);

-- ── 3. Row-level security ──────────────────────────────────────────────────────
alter table public.shopping_lists      enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.price_alert_hits    enable row level security;

drop policy if exists "own shopping lists" on public.shopping_lists;
create policy "own shopping lists" on public.shopping_lists
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own shopping list items" on public.shopping_list_items;
create policy "own shopping list items" on public.shopping_list_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own alert hits" on public.price_alert_hits;
create policy "own alert hits" on public.price_alert_hits
  for all to authenticated
  using (exists (select 1 from public.price_alerts a where a.id = alert_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.price_alerts a where a.id = alert_id and a.user_id = auth.uid()));

revoke all on public.shopping_lists, public.shopping_list_items, public.price_alert_hits from anon;
grant select, insert, update, delete on public.shopping_lists, public.shopping_list_items, public.price_alert_hits to authenticated;

-- ── 4. Basket quote: one row per store that has >= 1 of the list's products ───
-- Items whose product_id is null are matched by their name fingerprint at quote time.
-- basket_total = sum(latest community price at that store × qty) over the items found there.
-- lat/lng come from the store row so the app can show a distance (position never leaves the phone).
create or replace function public.basket_quote(p_list uuid, p_city text default null, p_currency text default 'MZN')
returns table (
  store_id uuid, store_name text, branch_address text, city text, store_type text,
  lat double precision, lng double precision,
  items_found int, items_total int, basket_total numeric, items jsonb)
language sql stable as $$
  with li as (
    select i.id, i.name, i.qty,
           coalesce(i.product_id,
                    (select p.id from public.products p where p.product_key = public.product_key_clean(i.name) limit 1)) as product_id
    from public.shopping_list_items i
    where i.list_id = p_list and i.user_id = auth.uid()
  ),
  total as (select count(*)::int as n from li),
  matched as (
    select li.id as item_id, li.name, li.qty, c.store_id, c.city, c.price, c.observed_on, c.report_count
    from li
    join public.community_prices c on c.product_id = li.product_id
    where li.product_id is not null
      and c.currency = upper(coalesce(p_currency, 'MZN'))
      and (p_city is null or c.city = p_city)
  )
  select m.store_id, s.name, s.branch_address, min(m.city), s.store_type, s.lat, s.lng,
         count(*)::int,
         (select n from total),
         round(sum(m.price * m.qty), 2),
         jsonb_agg(jsonb_build_object(
           'item_id', m.item_id, 'name', m.name, 'qty', m.qty, 'price', m.price,
           'line_total', round(m.price * m.qty, 2), 'observed_on', m.observed_on, 'report_count', m.report_count)
           order by m.name)
  from matched m
  join public.stores s on s.id = m.store_id
  group by m.store_id, s.name, s.branch_address, s.store_type, s.lat, s.lng
  order by 8 desc, 10 asc;
$$;

revoke execute on function public.basket_quote(uuid, text, text) from public, anon;
grant execute on function public.basket_quote(uuid, text, text) to authenticated;

-- ── 5. Alerts whose product is now at or below the target (cheapest current community price) ──
-- Alerts already recorded in price_alert_hits are skipped, so each hit is shown once.
create or replace function public.check_price_alerts()
returns table (
  alert_id uuid, product_id uuid, product_key text, display_name text, currency text, target_price numeric,
  price numeric, store_id uuid, store_name text, branch_address text, city text, observed_on date)
language sql stable as $$
  select a.id, a.product_id, p.product_key, p.display_name, a.currency, a.target_price,
         c.price, c.store_id, c.store_name, c.branch_address, c.city, c.observed_on
  from public.price_alerts a
  join public.products p on p.id = a.product_id
  join lateral (
    select cp.price, cp.store_id, cp.store_name, cp.branch_address, cp.city, cp.observed_on
    from public.community_prices cp
    where cp.product_id = a.product_id and cp.currency = a.currency
    order by cp.price asc, cp.observed_on desc
    limit 1
  ) c on true
  where a.user_id = auth.uid()
    and c.price <= a.target_price
    and not exists (select 1 from public.price_alert_hits h where h.alert_id = a.id)
  order by a.created_at desc;
$$;

revoke execute on function public.check_price_alerts() from public, anon;
grant execute on function public.check_price_alerts() to authenticated;
