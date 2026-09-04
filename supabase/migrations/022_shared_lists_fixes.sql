-- 022: fixes from the review of 021. Safe to re-run.
--  1. A shared list is usable only while its OWNER is still in that household; leaving or being removed
--     unshares the leaver's lists.
--  2. Merging a shared source list keeps the items other members added.
--  3. watch_list_items picks the caller's currency when none is given.

create or replace function public.can_use_list(p_list uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shopping_lists l
    where l.id = p_list
      and (l.user_id = auth.uid()
           or (l.household_id is not null and l.household_id = public.my_household_id()
               and exists (select 1 from public.household_members hm where hm.user_id = l.user_id and hm.household_id = l.household_id)))
  );
$$;

drop policy if exists "read own or household lists" on public.shopping_lists;
create policy "read own or household lists" on public.shopping_lists for select to authenticated
  using (user_id = auth.uid()
         or (household_id is not null and household_id = public.my_household_id()
             and exists (select 1 from public.household_members hm where hm.user_id = shopping_lists.user_id and hm.household_id = shopping_lists.household_id)));

-- leaving / being removed unshares the person's lists (recreated from 010 with one extra statement each)
create or replace function public.leave_household() returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  was_owner boolean;
  next_owner uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select household_id, role = 'owner' into hid, was_owner from public.household_members where user_id = uid;
  if hid is null then return; end if;
  update public.shopping_lists set household_id = null where user_id = uid and household_id = hid;
  delete from public.household_members where user_id = uid;
  if not exists (select 1 from public.household_members where household_id = hid) then
    delete from public.households where id = hid;
  elsif was_owner then
    select user_id into next_owner from public.household_members where household_id = hid order by joined_at limit 1;
    update public.household_members set role = 'owner' where user_id = next_owner;
  end if;
end;
$$;

create or replace function public.remove_household_member(p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select household_id into hid from public.household_members where user_id = uid and role = 'owner';
  if hid is null then raise exception 'not owner'; end if;
  if p_user = uid then raise exception 'use leave'; end if;
  update public.shopping_lists set household_id = null where user_id = p_user and household_id = hid;
  delete from public.household_members where user_id = p_user and household_id = hid;
end;
$$;

-- merge keeps every item of the source lists, whoever added it (ownership of the lists is already checked)
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

-- currency defaults to what the caller's receipts use
create or replace function public.watch_list_items(p_list uuid, p_currency text default null) returns int
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  cur text;
  n int := 0;
  r record;
  pid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not public.can_use_list(p_list) then raise exception 'not your list'; end if;
  cur := coalesce(upper(nullif(trim(p_currency), '')),
                  (select r2.currency from public.receipts r2 where r2.user_id = uid and r2.currency is not null group by r2.currency order by count(*) desc limit 1),
                  'MZN');
  for r in select i.name, i.product_id from public.shopping_list_items i where i.list_id = p_list and not i.checked loop
    pid := coalesce(r.product_id, (select p.id from public.products p where p.product_key = public.product_key_clean(r.name) limit 1));
    if pid is null then continue; end if;
    insert into public.watch_items (user_id, product_id, currency, source, notify, hidden)
    values (uid, pid, cur, 'pinned', true, false)
    on conflict (user_id, product_id, currency) do update set notify = true, hidden = false, source = 'pinned';
    n := n + 1;
  end loop;
  return n;
end;
$$;
do $$ declare f text; begin
  foreach f in array array['can_use_list(uuid)', 'leave_household()', 'remove_household_member(uuid)', 'merge_shopping_lists(uuid, uuid[])', 'watch_list_items(uuid, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
