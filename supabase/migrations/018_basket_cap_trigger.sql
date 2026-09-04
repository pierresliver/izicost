-- 018: adding a basket item failed with "infinite recursion detected in policy" (PS, 2026-09-04): the 200-item
-- cap in 006 counted rows of shopping_list_items INSIDE that table's own policy, which re-applies the policy.
-- The cap moves to a security-definer trigger (same pattern as the receipt caps in 013). Safe to re-run.
drop policy if exists "own shopping list items" on public.shopping_list_items;
create policy "own shopping list items" on public.shopping_list_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid())
  );

create or replace function public.cap_shopping_list_items() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.shopping_list_items where list_id = new.list_id) >= 200 then
    raise exception 'a basket holds at most 200 items';
  end if;
  return new;
end;
$$;
drop trigger if exists shopping_list_items_cap on public.shopping_list_items;
create trigger shopping_list_items_cap before insert on public.shopping_list_items for each row execute function public.cap_shopping_list_items();
grant execute on function public.cap_shopping_list_items() to authenticated;
