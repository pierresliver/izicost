-- 019: several shopping lists per user (merge them), and "typical price" ranking for the basket quote.
-- Safe to re-run.

-- Merge: every item of the source lists moves into the target (same product, or same name, adds up the
-- quantity); the source lists are deleted. Everything must belong to the caller.
create or replace function public.merge_shopping_lists(p_target uuid, p_sources uuid[])
returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  moved int := 0;
  r record;
  existing uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.shopping_lists where id = p_target and user_id = uid) then raise exception 'not your list'; end if;
  if coalesce(array_length(p_sources, 1), 0) > 20 then raise exception 'too many lists'; end if;
  if exists (select 1 from unnest(p_sources) s where s = p_target) then raise exception 'cannot merge a list into itself'; end if;
  if exists (select 1 from unnest(p_sources) s where not exists (select 1 from public.shopping_lists l where l.id = s and l.user_id = uid)) then
    raise exception 'not your list';
  end if;
  if (select count(*) from public.shopping_list_items where list_id = p_target) + (select count(*) from public.shopping_list_items where list_id = any(p_sources)) > 200 then
    raise exception 'a basket holds at most 200 items';
  end if;
  for r in select * from public.shopping_list_items where list_id = any(p_sources) and user_id = uid order by created_at loop
    select id into existing from public.shopping_list_items t
    where t.list_id = p_target and t.user_id = uid
      and ((r.product_id is not null and t.product_id = r.product_id) or lower(t.name) = lower(r.name))  -- same product OR same name, either way round
    limit 1;
    if existing is not null then
      update public.shopping_list_items set qty = least(1000, qty + r.qty), checked = checked and r.checked where id = existing;
      delete from public.shopping_list_items where id = r.id;
    else
      update public.shopping_list_items set list_id = p_target where id = r.id;
    end if;
    moved := moved + 1;
  end loop;
  delete from public.shopping_lists where id = any(p_sources) and user_id = uid;
  return moved;
end;
$$;
revoke execute on function public.merge_shopping_lists(uuid, uuid[]) from public, anon;
grant execute on function public.merge_shopping_lists(uuid, uuid[]) to authenticated;

-- A user may keep at most 20 lists.
create or replace function public.cap_shopping_lists() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.shopping_lists where user_id = new.user_id) >= 20 then
    raise exception 'at most 20 lists';
  end if;
  return new;
end;
$$;
drop trigger if exists shopping_lists_cap on public.shopping_lists;
create trigger shopping_lists_cap before insert on public.shopping_lists for each row execute function public.cap_shopping_lists();
grant execute on function public.cap_shopping_lists() to authenticated;

-- Basket quote: p_typical = true ranks with each store's 60-day median instead of the latest price.
drop function if exists public.basket_quote(uuid, text, text);
drop function if exists public.basket_quote(uuid, text, text, boolean);  -- re-runnable
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
    where i.list_id = p_list and i.user_id = auth.uid() and not i.checked  -- ticked = already bought
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
