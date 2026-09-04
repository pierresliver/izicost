-- 028: basket lines typed or spoken in everyday words ("cebola amarela 1kg") now find the pool's product ("Cebola kg")
-- when the first word matches, the names are similar (pg_trgm) and the sizes do not contradict each other.
-- PS's real basket (2026-09-04): 12 free-text lines, 0 matches with exact keys only. Safe to re-run.

-- Two sizes are compatible when either is unknown, or both convert to the same amount (2% tolerance).
create or replace function public.sizes_compatible(v1 numeric, u1 text, v2 numeric, u2 text) returns boolean
language sql immutable as $$
  with n as (
    select case u1 when 'kg' then v1 * 1000 when 'g' then v1 when 'l' then v1 * 1000 when 'ml' then v1 else v1 end as a,
           case u1 when 'kg' then 'g' when 'l' then 'ml' else u1 end as fa,
           case u2 when 'kg' then v2 * 1000 when 'g' then v2 when 'l' then v2 * 1000 when 'ml' then v2 else v2 end as b,
           case u2 when 'kg' then 'g' when 'l' then 'ml' else u2 end as fb
  )
  select v1 is null or v2 is null or u1 is null or u2 is null
      or (fa = fb and abs(a - b) <= 0.02 * greatest(a, b))
  from n;
$$;
revoke execute on function public.sizes_compatible(numeric, text, numeric, text) from public, anon;
grant execute on function public.sizes_compatible(numeric, text, numeric, text) to authenticated;

create or replace function public.list_item_candidates(p_product uuid, p_name text, p_brand_pref text)
returns setof uuid
language sql stable set search_path = public, extensions as $$
  with item as (
    select public.product_key_clean(p_name) as k,
           (public.parse_size(p_name)).size_value as sv, (public.parse_size(p_name)).size_unit as su
  ),
  base as (
    select coalesce(
             (select p.generic_key from public.products p where p.id = p_product),
             public.generic_key_of(item.k, public.detect_brand(item.k))) as g,
           coalesce(nullif(p_brand_pref, ''),
                    case when p_product is null then public.detect_brand(item.k) end) as b
    from item
  ),
  -- the first real word of the line ("cebola" in "cebola amarela 1kg"; skips de/da/com/sem…)
  first as (
    select split_part(regexp_replace(coalesce(item.k, ''), '^((de|da|do|dos|das|com|sem|para|o|a|um|uma|e) )+', ''), ' ', 1) as f from item
  ),
  exact as (
    select p.id from public.products p, base, item
     where p.id = p_product or p.generic_key = base.g or p.product_key = item.k
  ),
  fuzzy as (
    -- free-text lines only: same first word, similar name, compatible size; the 5 closest
    select p.id from public.products p, item, first
     where p_product is null
       and length(first.f) >= 3
       and position(' ' || first.f || ' ' in ' ' || p.product_key || ' ') > 0
       and similarity(item.k, p.product_key) >= 0.3
       and public.sizes_compatible(item.sv, item.su, p.size_value, p.size_unit)
     order by similarity(item.k, p.product_key) desc
     limit 5
  )
  select c.id from (select id from exact union select id from fuzzy) c
  join public.products p on p.id = c.id, base
  where base.b is null or public.brand_key(p.brand) = public.brand_key(base.b) or (p.id = p_product and p_brand_pref is null);
$$;
revoke execute on function public.list_item_candidates(uuid, text, text) from public, anon;
grant execute on function public.list_item_candidates(uuid, text, text) to authenticated;
