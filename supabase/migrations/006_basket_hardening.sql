-- Hardening after review of the basket / alerts feature. Idempotent.

-- Items may only be attached to the caller's own list, and a list is capped at 200 items.
drop policy if exists "own shopping list items" on public.shopping_list_items;
create policy "own shopping list items" on public.shopping_list_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid())
    and (select count(*) from public.shopping_list_items i where i.list_id = shopping_list_items.list_id) < 200
  );

-- Sensible quantity bound (a basket line of 1,000 units is already absurd).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shopping_list_items_qty_max') then
    alter table public.shopping_list_items add constraint shopping_list_items_qty_max check (qty <= 1000);
  end if;
end $$;

-- One alert per product and currency per user (the app upserts on this key).
create unique index if not exists price_alerts_user_product_currency
  on public.price_alerts (user_id, product_id, currency);
