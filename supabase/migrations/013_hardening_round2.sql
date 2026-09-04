-- 013: second hardening round (security review, 2026-09-03). Safe to re-run.
--  1. Functions: authenticated gets an explicit allowlist (like tables in 011), not whatever was auto-granted.
--  2. Sequences: authenticated only needs price_reports_id_seq.
--  3. Volume caps on receipts / receipt lines (a household member's flood would slow everyone in the household).
--  4. Household default display name no longer derived from the email address.

-- ── 1. functions ──────────────────────────────────────────────────────────────────────────────
revoke execute on all functions in schema public from authenticated;
-- extension functions (pg_trgm, unaccent) live in public and are needed by ordinary queries
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop execute format('grant execute on function %s to authenticated', r.sig); end loop;
end $$;
-- the app's RPCs and the helpers its invoker-security RPCs / trigger need
do $$ declare f text; begin
  foreach f in array array[
    'basket_quote(uuid, text, text, boolean)', 'merge_shopping_lists(uuid, uuid[])', 'check_price_alerts()',
    'canonical_city(text)', 'city_from_text(text, text)', 'parse_size(text)', 'per_unit_price(numeric, numeric, text)',
    'product_key(text)', 'product_key_clean(text)', 'receipt_item_to_price_point()',
    'search_prices(text, text, text, uuid[], integer)', 'product_prices(text)', 'product_trend(text, text, text)',
    'price_cities()', 'my_last_price(text)', 'nearby_stores(double precision, double precision, double precision)',
    'set_store_location(uuid, double precision, double precision)', 'min_reports()',
    'my_household_id()', 'household_user_ids()', 'household_overview()', 'create_household(text, text)', 'join_household(text, text)',
    'leave_household()', 'remove_household_member(uuid)', 'rotate_household_code()', 'rename_household(text)', 'set_my_display_name(text)',
    'watchlist_autofill(int)', 'watchlist_overview()'
  ] loop
    begin
      execute format('grant execute on function public.%s to authenticated', f);
    exception when undefined_function then
      raise notice 'skipping %, not (yet) defined', f;  -- signatures evolve in later migrations; never leave the allowlist half-applied
    end;
  end loop;
end $$;
-- internal only (never granted): assert_real_account, household_default_name, household_invite_code, upsert_product, quick_add_price
alter default privileges for role postgres in schema public revoke execute on functions from authenticated;

-- ── 2. sequences ──────────────────────────────────────────────────────────────────────────────
revoke all on all sequences in schema public from authenticated;
grant usage on sequence public.price_reports_id_seq to authenticated;   -- the only client-inserted table with a serial id
alter default privileges for role postgres in schema public revoke all on sequences from authenticated;

-- ── 3. volume caps ────────────────────────────────────────────────────────────────────────────
create or replace function public.cap_receipt_items() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.receipt_items where receipt_id = new.receipt_id) >= 300 then
    raise exception 'too many lines on one receipt';
  end if;
  return new;
end;
$$;
drop trigger if exists receipt_items_cap on public.receipt_items;
create trigger receipt_items_cap before insert on public.receipt_items for each row execute function public.cap_receipt_items();

create or replace function public.cap_receipts_per_day() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.receipts where user_id = new.user_id and created_at > now() - interval '1 day') >= 100 then
    raise exception 'too many receipts today';
  end if;
  return new;
end;
$$;
drop trigger if exists receipts_cap on public.receipts;
create trigger receipts_cap before insert on public.receipts for each row execute function public.cap_receipts_per_day();
grant execute on function public.cap_receipt_items() to authenticated;
grant execute on function public.cap_receipts_per_day() to authenticated;

-- ── 4. no email-derived default names ─────────────────────────────────────────────────────────
create or replace function public.household_default_name(p_uid uuid, p_name text) returns text
language sql stable security definer set search_path = public as $$
  select left(coalesce(nullif(trim(regexp_replace(p_name, '\s+', ' ', 'g')), ''), 'Member'), 40);
$$;
revoke execute on function public.household_default_name(uuid, text) from public, anon, authenticated;
