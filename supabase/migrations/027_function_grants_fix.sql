-- 027: function grants audit (PS hit "permission denied for function city_price_index", 2026-09-04).
-- Since 013 new functions get no automatic grant for authenticated, and 014–016 forgot the explicit grant on
-- city_price_index, city_staples, community_ticker and product_store_trend (the price-index screen, the staples
-- table, the ticker and the per-store chart were refused for every signed-in user).
-- Also: any function still executable through PUBLIC (i.e. by anon without a session) is switched to an explicit
-- authenticated grant, so the allowlist rule "anon can call nothing" holds for every function. Safe to re-run.

do $$ declare r record; begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')   -- extension functions stay
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- the four the app calls that had no grant at all
grant execute on function public.city_price_index(int) to authenticated;
grant execute on function public.city_staples(text, text) to authenticated;
grant execute on function public.community_ticker(int) to authenticated;
grant execute on function public.product_store_trend(text, text) to authenticated;

-- internal helpers stay internal (never callable from the app)
revoke execute on function public.assert_real_account() from public, anon, authenticated;
revoke execute on function public.household_default_name(uuid, text) from public, anon, authenticated;
revoke execute on function public.household_invite_code() from public, anon, authenticated;
revoke execute on function public.upsert_product(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.quick_add_price(text, numeric, text, text, text, numeric, text) from public, anon, authenticated;
