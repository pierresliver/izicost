-- 021: shared household shopping lists, "watch every item of a list", and the store page. Safe to re-run.

-- ── 1. A list can be shared with the creator's household ─────────────────────────────────────
alter table public.shopping_lists add column if not exists household_id uuid references public.households (id) on delete set null;
create index if not exists shopping_lists_household on public.shopping_lists (household_id);

/** May the caller read/edit this list's items? Own list, or a list shared with the caller's household. */
create or replace function public.can_use_list(p_list uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shopping_lists l
    where l.id = p_list and (l.user_id = auth.uid() or (l.household_id is not null and l.household_id = public.my_household_id()))
  );
$$;
revoke execute on function public.can_use_list(uuid) from public, anon;
grant execute on function public.can_use_list(uuid) to authenticated;

-- lists: members READ shared lists; only the creator changes, shares or deletes a list
drop policy if exists "own shopping lists" on public.shopping_lists;
drop policy if exists "read own or household lists" on public.shopping_lists;
drop policy if exists "insert own lists" on public.shopping_lists;
drop policy if exists "update own lists" on public.shopping_lists;
drop policy if exists "delete own lists" on public.shopping_lists;
create policy "read own or household lists" on public.shopping_lists for select to authenticated
  using (user_id = auth.uid() or (household_id is not null and household_id = public.my_household_id()));
create policy "insert own lists" on public.shopping_lists for insert to authenticated
  with check (user_id = auth.uid() and (household_id is null or household_id = public.my_household_id()));
create policy "update own lists" on public.shopping_lists for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and (household_id is null or household_id = public.my_household_id()));
create policy "delete own lists" on public.shopping_lists for delete to authenticated using (user_id = auth.uid());

-- items: anyone who can use the list can read, add, tick, change and remove its items
drop policy if exists "own shopping list items" on public.shopping_list_items;
drop policy if exists "read items of usable lists" on public.shopping_list_items;
drop policy if exists "insert items into usable lists" on public.shopping_list_items;
drop policy if exists "update items of usable lists" on public.shopping_list_items;
drop policy if exists "delete items of usable lists" on public.shopping_list_items;
create policy "read items of usable lists" on public.shopping_list_items for select to authenticated using (public.can_use_list(list_id));
create policy "insert items into usable lists" on public.shopping_list_items for insert to authenticated
  with check (user_id = auth.uid() and public.can_use_list(list_id));
create policy "update items of usable lists" on public.shopping_list_items for update to authenticated
  using (public.can_use_list(list_id)) with check (public.can_use_list(list_id));
create policy "delete items of usable lists" on public.shopping_list_items for delete to authenticated using (public.can_use_list(list_id));

-- the quote works for any list the caller can use
drop function if exists public.basket_quote(uuid, text, text, boolean);
create function public.basket_quote(p_list uuid, p_city text default null, p_currency text default 'MZN', p_typical boolean default false)
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
    where i.list_id = p_list and public.can_use_list(p_list) and not i.checked  -- ticked = already bought
  ),
  total as (select count(*)::int as n from li),
  matched as (
    select li.id as item_id, li.name, li.qty, c.store_id, c.city,
           case when p_typical then coalesce(c.median_price, c.price) else c.price end as price,
           c.observed_on, c.report_count
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
revoke execute on function public.basket_quote(uuid, text, text, boolean) from public, anon;
grant execute on function public.basket_quote(uuid, text, text, boolean) to authenticated;

-- ── 2. Watch every item of a list (price alerts for the whole list) ───────────────────────────
create or replace function public.watch_list_items(p_list uuid, p_currency text default 'MZN') returns int
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  n int := 0;
  r record;
  pid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not public.can_use_list(p_list) then raise exception 'not your list'; end if;
  for r in select i.name, i.product_id from public.shopping_list_items i where i.list_id = p_list and not i.checked loop
    pid := coalesce(r.product_id, (select p.id from public.products p where p.product_key = public.product_key_clean(r.name) limit 1));
    if pid is null then continue; end if;
    insert into public.watch_items (user_id, product_id, currency, source, notify, hidden)
    values (uid, pid, upper(coalesce(p_currency, 'MZN')), 'pinned', true, false)
    on conflict (user_id, product_id, currency) do update set notify = true, hidden = false, source = 'pinned';
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.watch_list_items(uuid, text) from public, anon;
grant execute on function public.watch_list_items(uuid, text) to authenticated;

-- ── 3. Store page: what a shop charges vs its city, and how its prices move ───────────────────
drop function if exists public.store_overview(uuid, text);
create function public.store_overview(p_store uuid, p_currency text default 'MZN')
returns table (product_key text, display_name text, size_value numeric, size_unit text, category text,
               price numeric, observed_on date, report_count int, city_median numeric, diff_pct numeric)
language sql stable security definer set search_path = public, extensions as $$
  with s as (select id, city from public.stores where id = p_store),
  mine as (
    select c.product_id, c.product_key, c.display_name, c.size_value, c.size_unit, c.category, c.price, c.observed_on, c.report_count
    from public.community_prices c where c.store_id = p_store and c.currency = upper(p_currency)
  ),
  citymed as (
    select pp.product_id, round((percentile_cont(0.5) within group (order by pp.price))::numeric, 2) as med
    from public.price_points pp join s on pp.city = s.city
    where pp.currency = upper(p_currency) and pp.observed_on >= current_date - 30
    group by pp.product_id having count(*) >= public.min_reports()
  )
  select m.product_key, m.display_name, m.size_value, m.size_unit, m.category, m.price, m.observed_on, m.report_count, cm.med,
         case when cm.med > 0 then round(((m.price - cm.med) / cm.med * 100)::numeric, 1) end as diff_pct
  from mine m left join citymed cm on cm.product_id = m.product_id
  order by diff_pct nulls last, m.display_name;
$$;

-- Weekly index for one store: each product relative to its first week at that store, median across products (base 100).
drop function if exists public.store_index(uuid, text);
create function public.store_index(p_store uuid, p_currency text default 'MZN')
returns table (week_start date, index numeric, products int)
language sql stable security definer set search_path = public, extensions as $$
  with pts as (
    select pp.product_id, date_trunc('week', pp.observed_on)::date as wk, percentile_cont(0.5) within group (order by pp.price) as med
    from public.price_points pp
    where pp.store_id = p_store and pp.currency = upper(p_currency) and pp.observed_on >= current_date - 180
    group by 1, 2
  ),
  base as (select distinct on (product_id) product_id, med as base_med from pts order by product_id, wk),
  rel as (select p.wk, p.med / b.base_med as r from pts p join base b using (product_id) where b.base_med > 0)
  select wk, round(((percentile_cont(0.5) within group (order by r)) * 100)::numeric, 1), count(*)::int
  from rel group by wk having count(*) >= 3 order by wk;
$$;
do $$ declare f text; begin
  foreach f in array array['store_overview(uuid, text)', 'store_index(uuid, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
