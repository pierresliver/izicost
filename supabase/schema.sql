-- IziCost — Phase 1 database schema (private layer only; community prices come in Phase 3).
-- Safe to run more than once.

create extension if not exists pgcrypto;

-- ── Stores (shared reference data: one row per branch) ─────────────────────────
create table if not exists public.stores (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_key        text not null,            -- lower-cased, accent-stripped name for matching
  branch_address  text,
  tax_id          text,                     -- NUIT / VAT number, digits only
  store_type      text,
  country         text,
  city            text,
  lat             double precision,
  lng             double precision,
  created_at      timestamptz not null default now()
);
create unique index if not exists stores_identity
  on public.stores (name_key, coalesce(tax_id, ''), coalesce(branch_address, ''));

-- ── Receipts (PRIVATE: locked to the user who scanned them) ────────────────────
create table if not exists public.receipts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  store_id             uuid references public.stores (id),
  store_name           text,
  store_branch_address text,
  store_tax_id         text,
  store_type           text,
  doc_type             text,
  country              text,
  currency             text,
  receipt_number       text,
  purchased_on         date,
  purchased_at_time    time,
  subtotal             numeric(14,2),
  tax_total            numeric(14,2),
  discount_total       numeric(14,2),
  total                numeric(14,2),
  payment_method       text,
  image_path           text,                -- path inside the private "receipts" storage bucket
  legibility           text,
  notes                text,
  raw_extraction       jsonb,               -- exactly what the model returned, before edits
  model                text,
  confirmed            boolean not null default false,
  created_at           timestamptz not null default now()
);
create index if not exists receipts_user_date on public.receipts (user_id, purchased_on desc);

create table if not exists public.receipt_items (
  id               uuid primary key default gen_random_uuid(),
  receipt_id       uuid not null references public.receipts (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  line_no          integer not null,
  name_as_printed  text not null,
  product_name     text,
  qty              numeric(12,3),
  unit_price       numeric(14,2),
  line_total       numeric(14,2),
  category         text,
  subcategory      text,
  created_at       timestamptz not null default now()
);
create index if not exists receipt_items_user on public.receipt_items (user_id, category);

-- ── Row-level security: a user sees only their own rows ────────────────────────
alter table public.receipts      enable row level security;
alter table public.receipt_items enable row level security;
alter table public.stores        enable row level security;

drop policy if exists "own receipts" on public.receipts;
create policy "own receipts" on public.receipts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own receipt items" on public.receipt_items;
create policy "own receipt items" on public.receipt_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- the parent receipt must be the caller's too (no attaching lines to someone else's receipt)
    and exists (select 1 from public.receipts r where r.id = receipt_id and r.user_id = auth.uid())
  );

drop policy if exists "stores readable" on public.stores;
create policy "stores readable" on public.stores for select to authenticated using (true);
drop policy if exists "stores insertable" on public.stores;
-- clients may create a branch but never with coordinates or a city: those come from the server side
create policy "stores insertable" on public.stores for insert to authenticated
  with check (lat is null and lng is null and city is null and length(name) <= 120);

-- ── Private storage bucket for receipt photos: <user_id>/<file>.jpg ────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "own receipt photos read" on storage.objects;
create policy "own receipt photos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own receipt photos write" on storage.objects;
create policy "own receipt photos write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own receipt photos delete" on storage.objects;
create policy "own receipt photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
