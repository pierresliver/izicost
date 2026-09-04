-- 026: brand fixes from the Day 4 review (2026-09-04). Safe to re-run.
--  1. A product named only "brand + size" ("Parmalat 1L") must NOT collapse to the generic "1l" (which would make milk,
--     oil and water one family): the remainder must still contain a word, else the generic key is the product key.
--  2. Only trusted seeders may teach new brands; manual (typed) lines of non-seeders never touch the catalogue.
--  3. Seed list cleaned ('Oleo' = cooking oil, 'Rooibos' = a tea type, 'Nestle Bar One' → 'Bar One'); deterministic tie-break.
--  4. basket_quote / item_brand_options use a LATERAL join (the candidate function ran once per price row before).
--  5. brand_key / generic_key_of are stable (unaccent is dictionary-dependent), search_path pinned.

delete from public.brands where name in ('Oleo', 'Rooibos', 'Nestle Bar One');
insert into public.brands (name, name_key) values ('Bar One', public.brand_key('Bar One')) on conflict do nothing;

create or replace function public.brand_key(p_name text) returns text
language sql stable set search_path = public, extensions as $$
  select nullif(trim(regexp_replace(regexp_replace(lower(unaccent(coalesce(p_name, ''))), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')), '');
$$;

create or replace function public.detect_brand(p_key text) returns text
language sql stable set search_path = public, extensions as $$
  select b.name from public.brands b
   where position(' ' || b.name_key || ' ' in ' ' || coalesce(p_key, '') || ' ') > 0
   order by length(b.name_key) desc, b.name_key limit 1;
$$;

create or replace function public.generic_key_of(p_key text, p_brand text) returns text
language sql stable set search_path = public, extensions as $$
  with r as (
    select nullif(trim(regexp_replace(
      case when p_brand is null then ' ' || coalesce(p_key, '') || ' '
           else replace(' ' || coalesce(p_key, '') || ' ', ' ' || public.brand_key(p_brand) || ' ', ' ') end,
      '\s+', ' ', 'g')), '') as rem
  )
  select case when rem ~ '(^| )[a-z]{2,}( |$)' then rem else p_key end from r;   -- "1l" / "2kg" alone are sizes, not products
$$;

create or replace function public.upsert_product(p_name text, p_category text default null, p_subcategory text default null, p_brand text default null)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  k text := public.product_key_clean(p_name);
  sz record;
  pid uuid;
  b text;
  bk text;
begin
  if k is null or length(k) < 2 then return null; end if;
  select * into sz from public.parse_size(p_name);
  b := coalesce(nullif(left(trim(p_brand), 60), ''), public.detect_brand(k));
  bk := public.brand_key(b);
  -- a brand passed in (trusted shelf scans only, see save_shelf_scan) joins the reference list when it looks like a name
  if p_brand is not null and b is not null and bk is not null and length(bk) >= 2 and bk ~ '[a-z]'
     and not exists (select 1 from public.brands where name_key = bk) then
    insert into public.brands (name, name_key) values (b, bk) on conflict do nothing;
  end if;
  insert into public.products (product_key, display_name, size_value, size_unit, category, subcategory, brand, generic_key)
  values (k, initcap(trim(regexp_replace(p_name, '\s+', ' ', 'g'))), sz.size_value, sz.size_unit, p_category, p_subcategory, b, public.generic_key_of(k, b))
  on conflict (product_key) do update
    set category    = coalesce(public.products.category, excluded.category),
        subcategory = coalesce(public.products.subcategory, excluded.subcategory),
        size_value  = coalesce(public.products.size_value, excluded.size_value),
        size_unit   = coalesce(public.products.size_unit, excluded.size_unit),
        brand       = coalesce(public.products.brand, excluded.brand),
        generic_key = coalesce(public.products.generic_key, excluded.generic_key)
  returning id into pid;
  return pid;
end;
$$;
revoke execute on function public.upsert_product(text, text, text, text) from public, anon, authenticated;

-- full recompute once (the earlier backfill skipped rows that already had a generic key)
update public.products p
   set brand = coalesce(p.brand, public.detect_brand(p.product_key)),
       generic_key = public.generic_key_of(p.product_key, coalesce(p.brand, public.detect_brand(p.product_key)));

-- save_shelf_scan: typed lines of non-seeders never reach the catalogue; only seeders teach brands
create or replace function public.save_shelf_scan(p_store uuid, p_currency text, p_items jsonb, p_photo_count int default 0)
returns table (scan_id uuid, saved int, published int)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  s record;
  it jsonb;
  v_name text; v_brand text; v_price numeric; v_cat text; v_sub text; v_promo boolean; v_manual boolean; v_per text; v_unit numeric;
  v_pid uuid; p record;
  v_city text; v_country text;
  v_scan uuid; v_item bigint; n_saved int := 0; n_pub int := 0;
  today_items int;
  is_seeder boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not public.shelf_scan_allowed() then raise exception 'shelf scan is not enabled for this account'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'items must be a list'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'nothing to save'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'too many items in one scan (max 200)'; end if;
  if upper(coalesce(p_currency, '')) not in ('MZN', 'ZAR') then raise exception 'unsupported currency'; end if;
  select id, name, branch_address, city, country into s from public.stores where id = p_store;
  if s.id is null then raise exception 'unknown store'; end if;
  if (s.country = 'ZA' and upper(p_currency) <> 'ZAR') or (s.country = 'MZ' and upper(p_currency) <> 'MZN') then
    raise exception 'currency does not match the shop''s country';
  end if;
  is_seeder := exists (select 1 from public.trusted_seeders where user_id = uid);
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
    begin v_price := round((it->>'price')::numeric, 2); exception when others then v_price := null; end;
    if v_price is null or v_price < 0.01 or v_price >= 10000000 then continue; end if;
    v_brand := nullif(left(trim(regexp_replace(coalesce(it->>'brand', ''), '\s+', ' ', 'g')), 60), '');
    v_cat := nullif(it->>'category', '');
    if v_cat is not null and v_cat not in ('food','drink','alcohol','household','personal_care','pharmacy','pet','clothing','electronics','other') then v_cat := 'other'; end if;
    v_sub := nullif(it->>'subcategory', '');
    if v_sub is not null and v_sub not in ('vegetables','fruit','red_meat','poultry','fish_seafood','dairy_eggs','bakery_bread','pantry','breakfast_cereal','snacks_sweets','frozen','baby_food','other_food',
        'water','soft_drink','juice','coffee_tea','energy_drink','beer','wine','spirits','cider','cleaning','kitchen','bags_packaging','home_decor','garden',
        'toiletries','cosmetics','medicine','supplements','pet_food','pet_supplies','clothing','shoes','accessories','electronics','other') then v_sub := null; end if;
    begin v_promo := coalesce((it->>'promo')::boolean, false); exception when others then v_promo := false; end;
    begin v_manual := coalesce((it->>'manual')::boolean, false); exception when others then v_manual := true; end;
    v_per := case when it->>'price_per' in ('per_kg', 'per_l') then it->>'price_per' else 'each' end;

    -- the private line is always kept for the author
    insert into public.shelf_items (scan_id, user_id, name, brand, price, promo, category, subcategory, published, manual, price_per)
    values (v_scan, uid, v_name, v_brand, v_price, v_promo, v_cat, v_sub, false, v_manual, v_per)
    returning id into v_item;
    n_saved := n_saved + 1;
    if v_manual and not is_seeder then continue; end if;   -- typed, not read: never reaches the shared catalogue unless trusted

    v_pid := public.upsert_product(v_name, v_cat, v_sub, case when is_seeder then v_brand end);
    if v_pid is null then continue; end if;
    select size_value, size_unit into p from public.products where id = v_pid;
    v_unit := case when v_per = 'each' then public.per_unit_price(v_price, p.size_value, p.size_unit) else v_price end;

    update public.price_points set price = v_price, unit_price = v_unit, observed_on = current_date
     where product_id = v_pid and store_id = s.id and currency = upper(p_currency) and source = 'shelf' and observed_on >= current_date - 6;
    if not found then
      insert into public.price_points (product_id, store_id, country, city, price, unit_price, currency, observed_on, source)
      values (v_pid, s.id, v_country, v_city, v_price, v_unit, upper(p_currency), current_date, 'shelf');
    end if;
    update public.shelf_items set published = true where id = v_item;
    n_pub := n_pub + 1;
  end loop;

  update public.shelf_scans set item_count = n_saved, published = n_pub where id = v_scan;
  return query select v_scan, n_saved, n_pub;
end;
$$;
revoke execute on function public.save_shelf_scan(uuid, text, jsonb, int) from public, anon;
grant execute on function public.save_shelf_scan(uuid, text, jsonb, int) to authenticated;

-- basket_quote with a LATERAL join (candidates computed once per list line, not once per price row)
drop function if exists public.basket_quote(uuid, text, text, boolean);
create function public.basket_quote(p_list uuid, p_city text default null, p_currency text default 'MZN', p_typical boolean default false)
returns table (
  store_id uuid, store_name text, branch_address text, city text, store_type text,
  lat double precision, lng double precision,
  items_found int, items_total int, basket_total numeric, items jsonb)
language sql stable as $$
  with li as (
    select i.id, i.name, i.qty, i.product_id, i.brand_pref
    from public.shopping_list_items i
    where i.list_id = p_list and public.can_use_list(p_list) and not i.checked  -- ticked = already bought
  ),
  total as (select count(*)::int as n from li),
  cand as (
    select li.id as item_id, li.name, li.qty, c.store_id, c.city,
           case when p_typical then coalesce(c.median_price, c.price) else c.price end as price,
           c.observed_on, c.report_count, c.display_name as product_name, pr.brand, c.product_key,
           row_number() over (partition by li.id, c.store_id order by
             case when p_typical then coalesce(c.median_price, c.price) else c.price end asc, c.observed_on desc, c.product_id) as rn
    from li
    cross join lateral public.list_item_candidates(li.product_id, li.name, li.brand_pref) as k(pid)
    join public.community_prices c on c.product_id = k.pid
    join public.products pr on pr.id = c.product_id
    where c.currency = upper(coalesce(p_currency, 'MZN'))
      and (p_city is null or c.city = p_city)
  ),
  matched as (select * from cand where rn = 1)   -- per shop and line: the cheapest brand that fits
  select m.store_id, s.name, s.branch_address, min(m.city), s.store_type, s.lat, s.lng,
         count(*)::int,
         (select n from total),
         round(sum(m.price * m.qty), 2),
         jsonb_agg(jsonb_build_object(
           'item_id', m.item_id, 'name', m.name, 'qty', m.qty, 'price', m.price,
           'line_total', round(m.price * m.qty, 2), 'observed_on', m.observed_on, 'report_count', m.report_count,
           'product_name', m.product_name, 'brand', m.brand, 'product_key', m.product_key)
           order by m.name)
  from matched m
  join public.stores s on s.id = m.store_id
  group by m.store_id, s.name, s.branch_address, s.store_type, s.lat, s.lng
  order by 8 desc, 10 asc;
$$;
revoke execute on function public.basket_quote(uuid, text, text, boolean) from public, anon;
grant execute on function public.basket_quote(uuid, text, text, boolean) to authenticated;

-- item_brand_options: invoker rights are enough (products and the k-anonymous view are readable; the line is RLS-filtered)
drop function if exists public.item_brand_options(uuid, text);
create function public.item_brand_options(p_item uuid, p_currency text default 'MZN')
returns table (brand text, product_key text, display_name text, min_price numeric, store_count int)
language sql stable set search_path = public, extensions as $$
  with i as (
    select product_id, name from public.shopping_list_items
     where id = p_item and public.can_use_list(list_id)
  ),
  c as (
    select p.id, p.brand, p.product_key, p.display_name
    from i
    cross join lateral public.list_item_candidates(i.product_id, i.name, null) as k(pid)
    join public.products p on p.id = k.pid
  )
  select c.brand, c.product_key, c.display_name, min(cp.price), count(distinct cp.store_id)::int
  from c left join public.community_prices cp on cp.product_id = c.id and cp.currency = upper(coalesce(p_currency, 'MZN'))
  group by c.id, c.brand, c.product_key, c.display_name
  order by min(cp.price) nulls last, c.display_name;
$$;
revoke execute on function public.item_brand_options(uuid, text) from public, anon;
grant execute on function public.item_brand_options(uuid, text) to authenticated;
