-- Scan accounting: one row per AI read, written by the extract-receipt function (service role).
-- Used for the per-user daily cap and for cost monitoring. Users can read their own rows.
create table if not exists public.scan_events (
  id            bigserial primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  image_count   integer not null default 1,
  model         text,
  input_tokens  integer,
  output_tokens integer,
  latency_ms    integer,
  ok            boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists scan_events_user_day on public.scan_events (user_id, created_at desc);

alter table public.scan_events enable row level security;
drop policy if exists "own scan events" on public.scan_events;
create policy "own scan events" on public.scan_events for select to authenticated using (user_id = auth.uid());
-- inserts happen only via the service role inside the function (no client policy on purpose)
