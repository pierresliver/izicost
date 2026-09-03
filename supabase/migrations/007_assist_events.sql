-- 007: small log of AI "assist" calls that are not receipt scans (e.g. turning a spoken shopping
-- list into items). Used only for a per-user daily cap inside the Edge Functions. Safe to re-run.
create table if not exists public.assist_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null,                     -- 'parse_list' ...
  ok          boolean not null default true,
  input_chars int,
  input_tokens  int,
  output_tokens int,
  latency_ms  int,
  created_at  timestamptz not null default now()
);
create index if not exists assist_events_user_time on public.assist_events (user_id, created_at desc);
alter table public.assist_events enable row level security;
-- No client policies on purpose: only the service role (Edge Functions) reads or writes this table.
revoke all on public.assist_events from anon, authenticated;
-- already-created table (first run lacked the FK): add it once
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'assist_events_user_id_fkey') then
    delete from public.assist_events e where not exists (select 1 from auth.users u where u.id = e.user_id); -- rows of deleted test accounts
    alter table public.assist_events add constraint assist_events_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end $$;

