-- 010: Households — family members share receipts so the household's spending shows together.
-- Rules (PS, 2026-09-03): one household per user; everyone in it sees everyone's receipts (read only —
-- you edit/delete only your own); join by a 6-character invite code; needs a real account (guests have
-- no stable identity). Community prices are untouched. Safe to re-run.

create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(name) between 1 and 60),
  invite_code  text not null unique check (invite_code ~ '^[A-Z2-9]{6}$'),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.household_members (
  user_id       uuid primary key references auth.users (id) on delete cascade,  -- one household per user
  household_id  uuid not null references public.households (id) on delete cascade,
  role          text not null check (role in ('owner', 'member')),
  display_name  text not null check (length(display_name) between 1 and 40),
  joined_at     timestamptz not null default now()
);
create index if not exists household_members_household on public.household_members (household_id);

alter table public.households        enable row level security;
alter table public.household_members enable row level security;

-- ── helpers (security definer so policies can consult membership without recursion) ──────────
create or replace function public.my_household_id() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

/** Me plus everyone in my household (just me when I am not in one). */
create or replace function public.household_user_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select auth.uid()
  union
  select m2.user_id
  from public.household_members m1
  join public.household_members m2 on m2.household_id = m1.household_id
  where m1.user_id = auth.uid();
$$;
revoke execute on function public.my_household_id() from public, anon;
revoke execute on function public.household_user_ids() from public, anon;
grant execute on function public.my_household_id() to authenticated;
grant execute on function public.household_user_ids() to authenticated;

-- ── read policies: members see their household; all writes go through the RPCs below ─────────
drop policy if exists "household readable by members" on public.households;
create policy "household readable by members" on public.households
  for select to authenticated using (id = public.my_household_id());
drop policy if exists "members readable by members" on public.household_members;
create policy "members readable by members" on public.household_members
  for select to authenticated using (household_id = public.my_household_id());

-- Receipts and their lines: household members may READ each other's rows. Insert/update/delete stay
-- with the existing "own receipts" / "own receipt items" policies (owner only).
drop policy if exists "household receipts read" on public.receipts;
create policy "household receipts read" on public.receipts
  for select to authenticated using (user_id in (select public.household_user_ids()));
drop policy if exists "household receipt items read" on public.receipt_items;
create policy "household receipt items read" on public.receipt_items
  for select to authenticated using (user_id in (select public.household_user_ids()));
-- Receipt photos too (read only).
drop policy if exists "household receipt photos read" on storage.objects;
create policy "household receipt photos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] in (select id::text from public.household_user_ids() as id));

-- ── RPCs ──────────────────────────────────────────────────────────────────────────────────────
create or replace function public.household_invite_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  code text;
begin
  loop
    select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '') into code from generate_series(1, 6);
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  return code;
end;
$$;
revoke execute on function public.household_invite_code() from public, anon, authenticated;

create or replace function public.household_default_name(p_uid uuid, p_name text) returns text
language sql stable security definer set search_path = public as $$
  select left(coalesce(nullif(trim(regexp_replace(p_name, '\s+', ' ', 'g')), ''),
                       (select split_part(email, '@', 1) from auth.users where id = p_uid),
                       'Member'), 40);
$$;
revoke execute on function public.household_default_name(uuid, text) from public, anon, authenticated;

-- Checked against auth.users, not the JWT: right after a guest upgrades to an account the phone still
-- holds the old token (is_anonymous = true) for up to an hour, but the users row is already updated.
create or replace function public.assert_real_account() returns void
language plpgsql stable security definer set search_path = public as $$
declare anon boolean;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select coalesce(is_anonymous, false) into anon from auth.users where id = auth.uid();
  if anon is null or anon then raise exception 'account required'; end if;
end;
$$;
revoke execute on function public.assert_real_account() from public, anon, authenticated;

create or replace function public.create_household(p_name text, p_display_name text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_name text := left(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 60);
  hid uuid;
begin
  perform public.assert_real_account();
  if length(v_name) < 1 then raise exception 'name required'; end if;
  if exists (select 1 from public.household_members where user_id = uid) then raise exception 'already in a household'; end if;
  insert into public.households (name, invite_code, created_by) values (v_name, public.household_invite_code(), uid) returning id into hid;
  insert into public.household_members (user_id, household_id, role, display_name)
  values (uid, hid, 'owner', public.household_default_name(uid, p_display_name));
  return public.household_overview();
end;
$$;

create or replace function public.join_household(p_code text, p_display_name text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  hid uuid;
begin
  perform public.assert_real_account();
  if exists (select 1 from public.household_members where user_id = uid) then raise exception 'already in a household'; end if;
  -- brute-force guard: 20 attempts per day
  if (select count(*) from public.assist_events where user_id = uid and kind = 'join_attempt' and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many attempts';
  end if;
  insert into public.assist_events (user_id, kind, ok) values (uid, 'join_attempt', false);
  select id into hid from public.households where invite_code = code;
  if hid is null then raise exception 'invalid code'; end if;
  if (select count(*) from public.household_members where household_id = hid) >= 12 then raise exception 'household full'; end if;
  insert into public.household_members (user_id, household_id, role, display_name)
  values (uid, hid, 'member', public.household_default_name(uid, p_display_name));
  update public.assist_events set ok = true where id = (select max(id) from public.assist_events where user_id = uid and kind = 'join_attempt');
  return public.household_overview();
end;
$$;

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
  delete from public.household_members where user_id = uid;
  if not exists (select 1 from public.household_members where household_id = hid) then
    delete from public.households where id = hid;                    -- last one out: household is gone
  elsif was_owner then
    select user_id into next_owner from public.household_members where household_id = hid order by joined_at limit 1;
    update public.household_members set role = 'owner' where user_id = next_owner;  -- hand over
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
  delete from public.household_members where user_id = p_user and household_id = hid;
end;
$$;

create or replace function public.rotate_household_code() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select household_id into hid from public.household_members where user_id = uid and role = 'owner';
  if hid is null then raise exception 'not owner'; end if;
  update public.households set invite_code = public.household_invite_code() where id = hid;
  return public.household_overview();
end;
$$;

create or replace function public.rename_household(p_name text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  v_name text := left(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 60);
begin
  if uid is null then raise exception 'not signed in'; end if;
  if length(v_name) < 1 then raise exception 'name required'; end if;
  select household_id into hid from public.household_members where user_id = uid and role = 'owner';
  if hid is null then raise exception 'not owner'; end if;
  update public.households set name = v_name where id = hid;
  return public.household_overview();
end;
$$;

create or replace function public.set_my_display_name(p_name text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_name text := left(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 40);
begin
  if uid is null then raise exception 'not signed in'; end if;
  if length(v_name) < 1 then raise exception 'name required'; end if;
  update public.household_members set display_name = v_name where user_id = uid;
  return public.household_overview();
end;
$$;

/** My household as one JSON object (null when I am not in one). */
create or replace function public.household_overview() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', h.id, 'name', h.name, 'invite_code', h.invite_code, 'my_role', me.role,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'display_name', m.display_name, 'role', m.role, 'joined_at', m.joined_at, 'is_me', m.user_id = auth.uid()
      ) order by m.joined_at), '[]'::jsonb)
      from public.household_members m where m.household_id = h.id))
  from public.household_members me
  join public.households h on h.id = me.household_id
  where me.user_id = auth.uid();
$$;

do $$ declare f text; begin
  foreach f in array array[
    'create_household(text, text)', 'join_household(text, text)', 'leave_household()', 'remove_household_member(uuid)',
    'rotate_household_code()', 'rename_household(text)', 'set_my_display_name(text)', 'household_overview()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ── Defence in depth: Supabase grants every privilege on new tables to anon/authenticated by default and
-- relies on RLS alone. Keep only what the app needs (members read their household), nothing for anon.
revoke all on public.households, public.household_members from anon, authenticated;
grant select on public.households, public.household_members to authenticated;
-- set_store_location (004) was still executable by anon: nothing useful without a session, but no reason to allow it
revoke execute on function public.set_store_location(uuid, double precision, double precision) from public, anon;
