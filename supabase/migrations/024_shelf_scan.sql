-- 024: Shelf scan (PS, 2026-09-04). Photos of shelf price labels become anonymous price points with
-- source 'shelf'. Because a shelf photo is not proof of purchase, only TRUSTED SEEDERS (a table we
-- manage by hand, scripts/trust-seeder.js) can use it until the setting 'shelf_scan_open' is '1'.
-- Everything is written through one security-definer RPC (validated, capped); the client has no
-- direct write access to any table here. Safe to re-run.

-- ── 1. price_points may now come from a shelf ────────────────────────────────────────────────
do $$ declare c text; begin
  select conname into c from pg_constraint
   where conrelid = 'public.price_points'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%source%';
  if c is not null then execute format('alter table public.price_points drop constraint %I', c); end if;
  alter table public.price_points add constraint price_points_source_check check (source in ('receipt', 'quick_add', 'shelf'));
end $$;

-- scan accounting: which reader produced the row (receipt photos vs shelf photos)
alter table public.scan_events add column if not exists kind text not null default 'receipt';

-- ── 2. who may publish shelf prices ──────────────────────────────────────────────────────────
create table if not exists public.trusted_seeders (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.trusted_seeders enable row level security;
revoke all on public.trusted_seeders from anon, authenticated;   -- readable only through shelf_scan_allowed()

insert into public.community_settings (key, value) values ('shelf_scan_open', '0') on conflict (key) do nothing;

create or replace function public.shelf_scan_allowed() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.trusted_seeders where user_id = auth.uid())
    or coalesce((select value from public.community_settings where key = 'shelf_scan_open'), '0') = '1'
  );
$$;
revoke execute on function public.shelf_scan_allowed() from public, anon;
grant execute on function public.shelf_scan_allowed() to authenticated;

-- ── 3. the scan itself (PRIVATE rows: only the author sees them; never joined to price_points) ──
create table if not exists public.shelf_scans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  store_id    uuid not null references public.stores (id) on delete cascade,
  currency    text not null,
  observed_on date not null default current_date,
  photo_count int  not null default 0,
  item_count  int  not null default 0,
  published   int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists shelf_scans_user on public.shelf_scans (user_id, created_at desc);
alter table public.shelf_scans enable row level security;
drop policy if exists "own shelf scans" on public.shelf_scans;
create policy "own shelf scans" on public.shelf_scans for select to authenticated using (user_id = auth.uid());
revoke all on public.shelf_scans from anon, authenticated;
grant select on public.shelf_scans to authenticated;

create table if not exists public.shelf_items (
  id         bigserial primary key,
  scan_id    uuid not null references public.shelf_scans (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  brand      text,
  price      numeric(14,2) not null,
  promo      boolean not null default false,
  category   text,
  subcategory text,
  published  boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shelf_items_scan on public.shelf_items (scan_id);
create index if not exists shelf_items_user_day on public.shelf_items (user_id, created_at desc);
alter table public.shelf_items enable row level security;
drop policy if exists "own shelf items" on public.shelf_items;
create policy "own shelf items" on public.shelf_items for select to authenticated using (user_id = auth.uid());
revoke all on public.shelf_items from anon, authenticated;
grant select on public.shelf_items to authenticated;

-- ── 4. save + publish in one validated call ──────────────────────────────────────────────────
-- p_items: [{name, brand, price, promo, category, subcategory}, ...]  (max 200)
-- Returns how many lines were stored and how many became community price points.
create or replace function public.save_shelf_scan(p_store uuid, p_currency text, p_items jsonb, p_photo_count int default 0)
returns table (scan_id uuid, saved int, published int)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  s record;
  it jsonb;
  v_name text; v_brand text; v_price numeric; v_cat text; v_sub text; v_promo boolean;
  v_pid uuid; p record;
  v_city text; v_country text;
  v_scan uuid; n_saved int := 0; n_pub int := 0;
  today_items int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not public.shelf_scan_allowed() then raise exception 'shelf scan is not enabled for this account'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'items must be a list'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'nothing to save'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'too many items in one scan (max 200)'; end if;
  if upper(coalesce(p_currency, '')) not in ('MZN', 'ZAR') then raise exception 'unsupported currency'; end if;
  select id, name, branch_address, city, country into s from public.stores where id = p_store;
  if s.id is null then raise exception 'unknown store'; end if;
  -- flood guard: 1500 shelf lines per person per day
  select count(*) into today_items from public.shelf_items where user_id = uid and created_at > now() - interval '1 day';
  if today_items + jsonb_array_length(p_items) > 1500 then raise exception 'daily shelf limit reached'; end if;

  v_country := nullif(s.country, '');
  v_city := coalesce(nullif(s.city, ''), public.city_from_text(coalesce(s.branch_address, '') || ' ' || coalesce(s.name, ''), v_country));
  if s.city is null and v_city is not null then
    update public.stores set city = v_city, country = coalesce(country, v_country) where id = s.id;
  end if;

  insert into public.shelf_scans (user_id, store_id, currency, photo_count)
  values (uid, p_store, upper(p_currency), greatest(0, least(coalesce(p_photo_count, 0), 500)))
  returning id into v_scan;

  for it in select * from jsonb_array_elements(p_items) loop
    v_name := left(trim(regexp_replace(coalesce(it->>'name', ''), '\s+', ' ', 'g')), 120);
    if length(v_name) < 2 then continue; end if;
    begin v_price := (it->>'price')::numeric; exception when others then v_price := null; end;
    if v_price is null or v_price <= 0 or v_price >= 10000000 then continue; end if;
    v_brand := nullif(left(trim(coalesce(it->>'brand', '')), 60), '');
    v_cat := nullif(it->>'category', '');
    if v_cat is not null and v_cat not in ('food','drink','alcohol','household','personal_care','pharmacy','pet','clothing','electronics','other') then v_cat := 'other'; end if;
    v_sub := nullif(left(coalesce(it->>'subcategory', ''), 40), '');
    v_promo := coalesce((it->>'promo')::boolean, false);

    -- the shelf line is private to the author; the pool only ever sees product/store/price/day
    v_pid := public.upsert_product(v_name, v_cat, v_sub);
    insert into public.shelf_items (scan_id, user_id, name, brand, price, promo, category, subcategory, published)
    values (v_scan, uid, v_name, v_brand, round(v_price, 2), v_promo, v_cat, v_sub, false);
    n_saved := n_saved + 1;
    if v_pid is null then continue; end if;
    select size_value, size_unit into p from public.products where id = v_pid;

    -- one shelf reading per product/store/day: a second pass the same day corrects the first
    update public.price_points set price = round(v_price, 2), unit_price = public.per_unit_price(v_price, p.size_value, p.size_unit)
     where product_id = v_pid and store_id = s.id and currency = upper(p_currency) and observed_on = current_date and source = 'shelf';
    if not found then
      insert into public.price_points (product_id, store_id, country, city, price, unit_price, currency, observed_on, source)
      values (v_pid, s.id, v_country, v_city, round(v_price, 2), public.per_unit_price(v_price, p.size_value, p.size_unit), upper(p_currency), current_date, 'shelf');
    end if;
    update public.shelf_items set published = true where id = currval('public.shelf_items_id_seq');
    n_pub := n_pub + 1;
  end loop;

  update public.shelf_scans set item_count = n_saved, published = n_pub where id = v_scan;
  return query select v_scan, n_saved, n_pub;
end;
$$;
revoke execute on function public.save_shelf_scan(uuid, text, jsonb, int) from public, anon;
grant execute on function public.save_shelf_scan(uuid, text, jsonb, int) to authenticated;

-- how many shelf lines I have contributed (for the Me tab / badges later)
create or replace function public.my_shelf_stats() returns table (scans int, items int, published int)
language sql stable security definer set search_path = public as $$
  select count(*)::int, coalesce(sum(item_count), 0)::int, coalesce(sum(published), 0)::int
    from public.shelf_scans where user_id = auth.uid();
$$;
revoke execute on function public.my_shelf_stats() from public, anon;
grant execute on function public.my_shelf_stats() to authenticated;
