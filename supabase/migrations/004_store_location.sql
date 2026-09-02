-- Lets the app pin a store branch to GPS coordinates the first time someone scans there.
-- Only fills empty coordinates (a later scan cannot move a store), and only for signed-in users.
create or replace function public.set_store_location(p_store uuid, p_lat double precision, p_lng double precision)
returns void
language sql
security definer
set search_path = public
as $$
  update public.stores
     set lat = p_lat, lng = p_lng
   where id = p_store
     and lat is null
     and p_lat between -90 and 90
     and p_lng between -180 and 180
     and auth.uid() is not null;
$$;
revoke all on function public.set_store_location(uuid, double precision, double precision) from public;
grant execute on function public.set_store_location(uuid, double precision, double precision) to authenticated;
