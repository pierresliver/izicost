-- IziCost — Phase 3: community prices (the anonymised, shared layer).
-- Depends on: schema.sql (stores, receipts, receipt_items). Safe to run more than once.
--
-- HARD RULE (MASTER_PLAN §9): nothing in the community layer links back to a person.
--   * price_points has NO user_id and NO receipt_id.
--   * The only table with a user id is quick_add_log (rate limiting) and it never joins to prices.
--   * price_reports store no user id either.

create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ── 1. Text helpers ────────────────────────────────────────────────────────────

-- Size printed in a product name → (value, unit). Units kept as printed ('kg','g','l','ml','un').
-- "2L", "2 LT", "500G", "1,5L", "750ml", "12 UN" all work. Returns nulls when nothing is found.
create or replace function public.parse_size(p_name text, out size_value numeric, out size_unit text)
language plpgsql immutable as $$
declare
  m text[];
  u text;
begin
  m := regexp_match(lower(coalesce(p_name, '')),
        '(\d+(?:[.,]\d+)?)\s*(kgs?|grs?|g|lts?|ltr|l|ml|cl|un|und|unid|uni|pcs?)(?![a-z])');
  if m is null then return; end if;
  size_value := replace(m[1], ',', '.')::numeric;
  u := m[2];
  size_unit := case
    when u in ('kg', 'kgs') then 'kg'
    when u in ('g', 'gr', 'grs') then 'g'
    when u in ('l', 'lt', 'lts', 'ltr') then 'l'
    when u = 'ml' then 'ml'
    when u = 'cl' then 'ml'
    else 'un'
  end;
  if u = 'cl' then size_value := size_value * 10; end if;
  if size_value <= 0 then size_value := null; size_unit := null; end if;
end;
$$;

-- Canonical fingerprint of a product name: lower-case, accents stripped, punctuation removed,
-- unit synonyms normalised and glued to their number ("2 LT" → "2l"), lone unit codes dropped
-- ("UN", "KG" on their own), spaces collapsed. "COCA-COLA 2 LT UN" → "coca cola 2l".
create or replace function public.product_key(p_name text) returns text
language sql stable as $$
  select nullif(trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(lower(unaccent(coalesce(p_name, ''))), '(\d)[.,](\d)', '\1.\2', 'g'),
                '[^a-z0-9.]+', ' ', 'g'),
              '\.(\D|$)', ' \1', 'g'),
            '(^|\D)\.', '\1 ', 'g'),
          '(\d)\s*(kgs?|grs?|g|lts?|ltr|l|ml|cl)(?![a-z])', '\1\2', 'g'),
        '(\d)(kgs)(?![a-z])', '\1kg', 'g'),
      '(\d)(grs?)(?![a-z])', '\1g', 'g'),
    '(\d)(lts?|ltr)(?![a-z])', '\1l', 'g')), '');
$$;

-- Second pass so the lone-token cleanup stays readable (drop 'un', 'kg', 'emb', 'cx', 'pc'…).
create or replace function public.product_key_clean(p_name text) returns text
language sql stable as $$
  select nullif(trim(regexp_replace(
    regexp_replace(' ' || coalesce(public.product_key(p_name), '') || ' ',
      '\s(un|und|unid|uni|unit|pc|pcs|cx|emb|kg|g|l|ml)(?=\s)', ' ', 'g'),
    '\s+', ' ', 'g')), '');
$$;

-- ── 2. Cities (reference data used to derive a city from a branch address) ────
create table if not exists public.cities (
  id       serial primary key,
  name     text not null,
  country  text not null,
  aliases  text[] not null default '{}',
  lat      double precision,
  lng      double precision
);
create unique index if not exists cities_name_country on public.cities (lower(name), country);

insert into public.cities (name, country, aliases, lat, lng) values
  ('Maputo',       'MZ', '{}',                    -25.9692, 32.5732),
  ('Matola',       'MZ', '{}',                    -25.9622, 32.4589),
  ('Beira',        'MZ', '{}',                    -19.8436, 34.8389),
  ('Nampula',      'MZ', '{}',                    -15.1165, 39.2666),
  ('Quelimane',    'MZ', '{}',                    -17.8786, 36.8883),
  ('Tete',         'MZ', '{}',                    -16.1564, 33.5867),
  ('Chimoio',      'MZ', '{}',                    -19.1164, 33.4833),
  ('Xai-Xai',      'MZ', '{"Xai Xai","Xaixai"}',  -25.0519, 33.6442),
  ('Inhambane',    'MZ', '{}',                    -23.8650, 35.3833),
  ('Pemba',        'MZ', '{}',                    -12.9740, 40.5178),
  ('Lichinga',     'MZ', '{}',                    -13.3128, 35.2406),
  ('Nacala',       'MZ', '{}',                    -14.5428, 40.6728),
  ('Malalane',     'ZA', '{"Malelane"}',          -25.4833, 31.5167),
  ('Komatipoort',  'ZA', '{}',                    -25.4333, 31.9500),
  ('Mbombela',     'ZA', '{"Nelspruit"}',         -25.4753, 30.9694),
  ('Johannesburg', 'ZA', '{"Joburg","Jozi"}',     -26.2041, 28.0473),
  ('Pretoria',     'ZA', '{"Tshwane"}',           -25.7479, 28.2293),
  ('Durban',       'ZA', '{"eThekwini"}',         -29.8587, 31.0218),
  ('Cape Town',    'ZA', '{"Kaapstad","Cidade do Cabo"}', -33.9249, 18.4241)
on conflict do nothing;

-- Find a known city mentioned in free text (address, store name). Returns the canonical name.
create or replace function public.city_from_text(p_text text, p_country text default null) returns text
language plpgsql stable as $$
declare
  hay text := ' ' || regexp_replace(lower(unaccent(coalesce(p_text, ''))), '[^a-z0-9]+', ' ', 'g') || ' ';
  c record;
  a text;
begin
  if length(hay) < 4 then return null; end if;
  for c in
    select name, aliases from public.cities
    where p_country is null or p_country = '' or country = p_country
    order by length(name) desc
  loop
    if position(' ' || regexp_replace(lower(unaccent(c.name)), '[^a-z0-9]+', ' ', 'g') || ' ' in hay) > 0 then
      return c.name;
    end if;
    foreach a in array c.aliases loop
      if position(' ' || regexp_replace(lower(unaccent(a)), '[^a-z0-9]+', ' ', 'g') || ' ' in hay) > 0 then
        return c.name;
      end if;
    end loop;
  end loop;
  return null;
end;
$$;

-- Canonicalise a city typed by a user ("nelspruit" → "Mbombela"); unknown names are kept, title-cased.
create or replace function public.canonical_city(p_city text, out city text, out country text)
language sql stable as $$
  select coalesce(c.name, nullif(initcap(trim(p_city)), '')), c.country
  from (select 1) x
  left join lateral (
    select name, country from public.cities
    where lower(unaccent(name)) = lower(unaccent(trim(p_city)))
       or exists (select 1 from unnest(aliases) al where lower(unaccent(al)) = lower(unaccent(trim(p_city))))
    limit 1
  ) c on true;
$$;

-- ── 3. Products (canonical catalogue) ──────────────────────────────────────────
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  product_key  text not null unique,
  display_name text not null,
  brand        text,
  size_value   numeric,
  size_unit    text check (size_unit is null or size_unit in ('kg', 'g', 'l', 'ml', 'un')),
  category     text,
  subcategory  text,
  created_at   timestamptz not null default now()
);
create index if not exists products_display_name_trgm on public.products using gin (display_name gin_trgm_ops);

-- ── 4. Price points (ANONYMISED — no user_id, no receipt_id, by design) ─────────
create table if not exists public.price_points (
  id          bigserial primary key,
  product_id  uuid not null references public.products (id) on delete cascade,
  store_id    uuid references public.stores (id) on delete cascade,
  country     text,
  city        text,
  price       numeric(14,2) not null,
  unit_price  numeric(14,4),               -- per kg / per l / per piece when the size is known
  currency    text not null,
  observed_on date not null,
  source      text not null default 'receipt' check (source in ('receipt', 'quick_add')),
  created_at  timestamptz not null default now()
);
create index if not exists price_points_product_date on public.price_points (product_id, observed_on desc);
create index if not exists price_points_store        on public.price_points (store_id);
create index if not exists price_points_place        on public.price_points (country, city);

-- Price per base unit (kg, l or piece) given the printed size.
create or replace function public.per_unit_price(p_price numeric, p_size_value numeric, p_size_unit text) returns numeric
language sql immutable as $$
  select case
    when p_price is null or p_size_value is null or p_size_value <= 0 then null
    when p_size_unit = 'kg' then p_price / p_size_value
    when p_size_unit = 'g'  then p_price / (p_size_value / 1000)
    when p_size_unit = 'l'  then p_price / p_size_value
    when p_size_unit = 'ml' then p_price / (p_size_value / 1000)
    when p_size_unit = 'un' then p_price / p_size_value
    else null
  end;
$$;

-- Find-or-create a product from a printed name. Used by the trigger and the quick-add RPC.
create or replace function public.upsert_product(p_name text, p_category text default null, p_subcategory text default null)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  k text := public.product_key_clean(p_name);
  sz record;
  pid uuid;
begin
  if k is null or length(k) < 2 then return null; end if;
  select * into sz from public.parse_size(p_name);
  insert into public.products (product_key, display_name, size_value, size_unit, category, subcategory)
  values (k, initcap(trim(regexp_replace(p_name, '\s+', ' ', 'g'))), sz.size_value, sz.size_unit, p_category, p_subcategory)
  on conflict (product_key) do update
    set category    = coalesce(public.products.category, excluded.category),
        subcategory = coalesce(public.products.subcategory, excluded.subcategory),
        size_value  = coalesce(public.products.size_value, excluded.size_value),
        size_unit   = coalesce(public.products.size_unit, excluded.size_unit)
  returning id into pid;
  return pid;
end;
$$;

-- ── 5. Trigger: every saved receipt line becomes one anonymous price point ─────
create or replace function public.receipt_item_to_price_point() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  s record;
  v_name text;
  v_pid uuid;
  v_price numeric;
  v_city text;
  v_country text;
  p record;
begin
  begin
    if new.qty is null or new.qty <= 0 then return new; end if;
    if coalesce(new.category, 'other') in ('restaurant', 'parking', 'utilities', 'services', 'transport', 'other') then
      return new;
    end if;
    v_price := coalesce(new.unit_price, new.line_total / new.qty);
    if v_price is null or v_price <= 0 then return new; end if;

    select currency, purchased_on, store_id, country, store_type into r from public.receipts where id = new.receipt_id;
    if r.store_id is null or r.currency is null then return new; end if;
    if coalesce(r.store_type, '') in ('restaurant', 'bar_cafe', 'parking', 'utility_provider') then return new; end if;

    select id, name, branch_address, city, country into s from public.stores where id = r.store_id;
    v_country := coalesce(nullif(s.country, ''), nullif(r.country, ''));
    v_city := coalesce(nullif(s.city, ''), public.city_from_text(coalesce(s.branch_address, '') || ' ' || coalesce(s.name, ''), v_country));
    if s.city is null and v_city is not null then
      update public.stores set city = v_city, country = coalesce(country, v_country) where id = s.id;
    end if;

    v_name := coalesce(nullif(trim(new.product_name), ''), new.name_as_printed);
    v_pid := public.upsert_product(v_name, new.category, new.subcategory);
    if v_pid is null then return new; end if;
    select size_value, size_unit into p from public.products where id = v_pid;

    -- same product/store/day already reported moments ago (e.g. the same item on two lines): count once
    if exists (select 1 from public.price_points
                where product_id = v_pid and store_id = r.store_id and currency = upper(r.currency)
                  and observed_on = coalesce(r.purchased_on, current_date) and source = 'receipt'
                  and created_at > now() - interval '2 minutes') then return new; end if;
    -- flood guard: at most 400 contributed lines per user per day (private rows only; nothing stored)
    if (select count(*) from public.receipt_items where user_id = new.user_id and created_at > now() - interval '1 day') > 400 then
      return new;
    end if;

    insert into public.price_points (product_id, store_id, country, city, price, unit_price, currency, observed_on, source)
    values (v_pid, r.store_id, v_country, v_city, round(v_price, 2),
            public.per_unit_price(v_price, p.size_value, p.size_unit),
            upper(r.currency), coalesce(r.purchased_on, current_date), 'receipt');
  exception when others then
    -- The community layer must never block a user's private save.
    raise warning 'price point skipped: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists receipt_items_to_price_points on public.receipt_items;
create trigger receipt_items_to_price_points
  after insert on public.receipt_items
  for each row execute function public.receipt_item_to_price_point();

-- ── 6. Community view: k-anonymity (>= 2 reports in 60 days) + freshness ──────
drop function if exists public.product_prices(text);  -- depends on the view type
drop view if exists public.community_prices;
-- Runs as the view owner: clients read ONLY through this view (k-anonymity enforced here).
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
  having count(*) >= 2
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

-- ── 7. Read RPCs ───────────────────────────────────────────────────────────────

-- Search (or, with a null query, "recently seen"): one row per product+currency, the cheapest
-- store in scope. Scope = any of country / city / a list of store ids (near me).
create or replace function public.search_prices(
  p_query text default null, p_country text default null, p_city text default null,
  p_store_ids uuid[] default null, p_limit int default 30)
returns table (
  product_key text, display_name text, size_value numeric, size_unit text,
  price numeric, unit_price numeric, currency text, store_name text, city text,
  observed_on date, report_count int, store_count int, last_seen date)
language sql stable as $$
  with scoped as (
    select * from public.community_prices c
    where (p_country is null or c.country = p_country)
      and (p_city is null or c.city = p_city)
      and (p_store_ids is null or c.store_id = any (p_store_ids))
      and (p_query is null or trim(p_query) = ''
           or c.product_key like '%' || public.product_key_clean(p_query) || '%'
           or c.display_name ilike '%' || trim(p_query) || '%')
  ),
  cheapest as (
    select distinct on (product_id, currency) *
    from scoped order by product_id, currency, price asc, observed_on desc
  ),
  stats as (
    select product_id, currency, count(distinct store_id)::int as store_count, max(observed_on) as last_seen
    from scoped group by product_id, currency
  )
  select c.product_key, c.display_name, c.size_value, c.size_unit,
         c.price, c.unit_price, c.currency, c.store_name, c.city,
         c.observed_on, c.report_count, st.store_count, st.last_seen
  from cheapest c join stats st using (product_id, currency)
  order by case when p_query is null or trim(p_query) = '' then st.last_seen end desc,
           c.display_name asc, c.price asc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

-- Every store's current price for one product (the product page).
create or replace function public.product_prices(p_key text)
returns setof public.community_prices
language sql stable as $$
  select * from public.community_prices where product_key = p_key order by currency, price asc, observed_on desc;
$$;

-- 90-day trend: min and median per ISO week, only weeks with >= 2 reports (k-anonymity).
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
  group by 1 having count(*) >= 2
  order by 1;
$$;

-- Cities that currently have community data (for the "My city" picker).
create or replace function public.price_cities()
returns table (city text, country text, product_count int)
language sql stable as $$
  select c.city, c.country, count(distinct c.product_id)::int
  from public.community_prices c where c.city is not null
  group by c.city, c.country order by 3 desc, 1;
$$;

-- The caller's own last purchase of a product (RLS applies: security invoker).
create or replace function public.my_last_price(p_key text)
returns table (price numeric, currency text, purchased_on date, store_name text)
language sql stable as $$
  select round(coalesce(ri.unit_price, ri.line_total / nullif(ri.qty, 0)), 2), r.currency, coalesce(r.purchased_on, ri.created_at::date), r.store_name
  from public.receipt_items ri
  join public.receipts r on r.id = ri.receipt_id
  where ri.user_id = auth.uid()
    and public.product_key_clean(coalesce(nullif(trim(ri.product_name), ''), ri.name_as_printed)) = p_key
  order by coalesce(r.purchased_on, ri.created_at::date) desc, ri.created_at desc
  limit 1;
$$;

-- Stores within p_km of a point (haversine, no PostGIS).
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
  where s.lat is not null and s.lng is not null and d.km <= p_km
  order by d.km
  limit 200;
$$;

-- ── 8. Quick add (informal markets) + rate limit log ──────────────────────────
create table if not exists public.quick_add_log (
  id         bigserial primary key,
  user_id    uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists quick_add_log_user_day on public.quick_add_log (user_id, created_at desc);

create or replace function public.quick_add_price(
  p_name text, p_price numeric, p_currency text, p_store_name text, p_city text,
  p_qty numeric default 1, p_size text default null)
returns table (product_key text, price_point_id bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  v_name text;
  v_key text;
  v_pid uuid;
  v_sid uuid;
  v_cur text := upper(trim(coalesce(p_currency, '')));
  v_store text := trim(regexp_replace(coalesce(p_store_name, ''), '\s+', ' ', 'g'));
  v_nk text;
  v_city text;
  v_country text;
  v_unit numeric;
  v_ppid bigint;
  pr record;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if (select count(*) from public.quick_add_log where user_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'rate_limit';
  end if;
  if p_price is null or p_price <= 0 then raise exception 'invalid price'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'invalid name'; end if;
  if length(v_store) < 2 then raise exception 'invalid store'; end if;
  if v_cur !~ '^[A-Z]{3}$' then raise exception 'invalid currency'; end if;
  if p_qty is null or p_qty <= 0 then p_qty := 1; end if;
  if length(trim(p_name)) > 80 or length(v_store) > 80 or p_price > 1000000 or p_qty > 1000 then raise exception 'invalid input'; end if;

  select * into pr from public.canonical_city(p_city);
  v_city := pr.city;
  v_country := coalesce(pr.country, case v_cur when 'MZN' then 'MZ' when 'ZAR' then 'ZA' else null end);
  if v_city is null or pr.country is null then raise exception 'invalid city'; end if;

  -- product: append the size when the name does not already carry one
  v_name := trim(p_name);
  if p_size is not null and trim(p_size) <> '' and (select size_value from public.parse_size(v_name)) is null then
    v_name := v_name || ' ' || trim(p_size);
  end if;
  v_pid := public.upsert_product(v_name, null, null);
  if v_pid is null then raise exception 'invalid name'; end if;
  select p.product_key, p.size_value, p.size_unit into pr from public.products p where p.id = v_pid;
  v_key := pr.product_key;
  v_unit := public.per_unit_price(p_price / p_qty, pr.size_value, pr.size_unit);

  -- store: informal markets are identified by name + city (branch_address = city)
  v_nk := trim(regexp_replace(lower(unaccent(v_store)), '[^a-z0-9]+', ' ', 'g'));
  select s.id into v_sid from public.stores s
  where s.name_key = v_nk and coalesce(s.tax_id, '') = '' and coalesce(s.branch_address, '') = v_city
  limit 1;
  if v_sid is null then
    insert into public.stores (name, name_key, branch_address, tax_id, store_type, country, city)
    values (v_store, v_nk, v_city, null, 'market_informal', v_country, v_city)
    returning id into v_sid;
  end if;

  insert into public.price_points (product_id, store_id, country, city, price, unit_price, currency, observed_on, source)
  values (v_pid, v_sid, v_country, v_city, round(p_price / p_qty, 2), v_unit, v_cur, current_date, 'quick_add')
  returning id into v_ppid;

  insert into public.quick_add_log (user_id) values (uid);
  return query select v_key, v_ppid;
end;
$$;

-- ── 9. Reports (no user id) and alerts (private) ───────────────────────────────
create table if not exists public.price_reports (
  id             bigserial primary key,
  price_point_id bigint not null references public.price_points (id) on delete cascade,
  reason         text check (reason is null or length(reason) <= 200),
  created_at     timestamptz not null default now()
);

create table if not exists public.price_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  product_id   uuid not null references public.products (id) on delete cascade,
  currency     text not null,
  target_price numeric(14,2) not null check (target_price > 0),
  created_at   timestamptz not null default now()
);
create index if not exists price_alerts_user on public.price_alerts (user_id);

-- ── 10. Row-level security & grants ───────────────────────────────────────────
alter table public.products      enable row level security;
alter table public.price_points  enable row level security;
alter table public.cities        enable row level security;
alter table public.quick_add_log enable row level security;
alter table public.price_reports enable row level security;
alter table public.price_alerts  enable row level security;

drop policy if exists "products readable" on public.products;
create policy "products readable" on public.products for select to authenticated using (true);

drop policy if exists "price points readable" on public.price_points;
drop policy if exists "price points readable" on public.price_points;
-- Raw price points are never readable by clients; everything goes through community_prices / definer RPCs.
revoke all on public.price_points from anon, authenticated;
-- no insert/update/delete policies: only the trigger and quick_add_price (security definer) write

drop policy if exists "cities readable" on public.cities;
create policy "cities readable" on public.cities for select to authenticated using (true);

-- quick_add_log: RLS enabled, no policies → no client access at all
revoke all on public.quick_add_log from anon, authenticated;

drop policy if exists "price reports insert" on public.price_reports;
create policy "price reports insert" on public.price_reports for insert to authenticated with check (true);
-- reports are write-only for clients (no select policy)

drop policy if exists "own price alerts" on public.price_alerts;
create policy "own price alerts" on public.price_alerts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.community_prices to authenticated;
revoke all on public.price_points, public.products, public.cities, public.price_reports, public.price_alerts, public.community_prices from anon;

revoke execute on function public.quick_add_price(text, numeric, text, text, text, numeric, text) from public, anon;
-- quick-add is OFF for launch (008_disable_quick_add.sql); the grant below is intentionally commented out so
-- re-running this file does not re-enable it. Re-enable later with:
-- grant execute on function public.quick_add_price(text, numeric, text, text, text, numeric, text) to authenticated;
revoke execute on function public.upsert_product(text, text, text) from public, anon, authenticated;

-- Hygiene: read RPCs and helpers are for signed-in users only.
revoke execute on function public.search_prices(text, text, text, uuid[], int) from public, anon;
revoke execute on function public.product_prices(text) from public, anon;
revoke execute on function public.product_trend(text, text, text) from public, anon;
revoke execute on function public.price_cities() from public, anon;
revoke execute on function public.my_last_price(text) from public, anon;
revoke execute on function public.nearby_stores(double precision, double precision, double precision) from public, anon;
grant execute on function public.product_trend(text, text, text) to authenticated;
