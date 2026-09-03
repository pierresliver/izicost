-- 011: least-privilege grants. Supabase grants EVERYTHING on every new table to the anon and authenticated
-- roles and relies on row-level security alone. Two layers are better than one:
--   * anon (a request with only the publishable key, no session) gets NOTHING in public — not even the
--     community_prices view, which as a view has no RLS and was readable without signing in;
--   * authenticated keeps exactly the verbs its RLS policies allow (nothing can TRUNCATE, no TRIGGER/REFERENCES).
-- Also fixes the defaults so future tables start locked for anon. Safe to re-run.

-- ── anon: nothing ─────────────────────────────────────────────────────────────────────────────
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- ── authenticated: only what the policies allow ───────────────────────────────────────────────
revoke all on all tables in schema public from authenticated;
-- own rows, full CRUD under RLS
grant select, insert, update, delete on public.receipts, public.receipt_items, public.budgets,
  public.shopping_lists, public.shopping_list_items, public.price_alerts, public.price_alert_hits to authenticated;
-- shared reference data
grant select on public.products, public.cities, public.community_prices, public.households, public.household_members to authenticated;
grant select, insert on public.stores to authenticated;      -- create a branch, never edit one
grant insert on public.price_reports to authenticated;       -- "wrong price" reports, write-only
grant select on public.scan_events to authenticated;         -- own rows (RLS): lets the app show usage later
-- price_points, quick_add_log, assist_events, community_settings: no client access (server side only)
alter default privileges for role postgres in schema public revoke all on tables from authenticated;

-- Own helper functions were executable by PUBLIC (Postgres default). They are pure text/number helpers, but
-- only signed-in sessions have any business calling them (search_prices runs as the caller and needs them).
do $$ declare f text; begin
  foreach f in array array['canonical_city(text)', 'city_from_text(text, text)', 'parse_size(text)',
                           'per_unit_price(numeric, numeric, text)', 'product_key(text)', 'product_key_clean(text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
