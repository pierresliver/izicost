-- 023: (security review of 021) an item's author and list cannot be changed by a client update — only the
-- server-side merge may move items between lists (it sets a transaction-local flag the trigger checks). Also the store index
-- honours min_reports() per product like every other community view. Safe to re-run.
create or replace function public.guard_shopping_list_item_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id <> old.user_id then raise exception 'the author of an item cannot change'; end if;
  -- only the server-side merge may move an item (it raises this transaction-local flag; clients cannot set it)
  if new.list_id <> old.list_id and coalesce(current_setting('izicost.allow_move', true), '') <> '1' then
    raise exception 'items cannot be moved between lists';
  end if;
  return new;
end;
$$;
drop trigger if exists shopping_list_items_guard on public.shopping_list_items;
create trigger shopping_list_items_guard before update on public.shopping_list_items for each row execute function public.guard_shopping_list_item_update();
revoke execute on function public.guard_shopping_list_item_update() from public, anon;
grant execute on function public.guard_shopping_list_item_update() to authenticated;

drop function if exists public.store_index(uuid, text);
create function public.store_index(p_store uuid, p_currency text default 'MZN')
returns table (week_start date, index numeric, products int)
language sql stable security definer set search_path = public, extensions as $$
  with pts as (
    select pp.product_id, date_trunc('week', pp.observed_on)::date as wk, percentile_cont(0.5) within group (order by pp.price) as med
    from public.price_points pp
    where pp.store_id = p_store and pp.currency = upper(p_currency) and pp.observed_on >= current_date - 180
    group by 1, 2 having count(*) >= public.min_reports()
  ),
  base as (select distinct on (product_id) product_id, med as base_med from pts order by product_id, wk),
  rel as (select p.wk, p.med / b.base_med as r from pts p join base b using (product_id) where b.base_med > 0)
  select wk, round(((percentile_cont(0.5) within group (order by r)) * 100)::numeric, 1), count(*)::int
  from rel group by wk having count(*) >= 3 order by wk;
$$;
revoke execute on function public.store_index(uuid, text) from public, anon;
grant execute on function public.store_index(uuid, text) to authenticated;

-- merge: raise the flag for the duration of the transaction
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
  perform set_config('izicost.allow_move', '1', true);
  for r in select * from public.shopping_list_items where list_id = any(p_sources) order by created_at loop
    select id into existing from public.shopping_list_items t
    where t.list_id = p_target
      and ((r.product_id is not null and t.product_id = r.product_id) or lower(t.name) = lower(r.name))
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
