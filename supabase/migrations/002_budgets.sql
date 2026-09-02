-- IziCost — Phase 2: budgets (one overall monthly limit per currency, plus optional per-category limits).
-- Safe to run more than once.

create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category    text null,                       -- null = overall budget
  amount      numeric(14,2) not null,
  currency    text not null,
  period      text not null default 'month',
  created_at  timestamptz default now()
);

-- "nulls not distinct" so there is only ONE overall (category = null) budget per user and currency.
drop index if exists budgets_identity;
create unique index budgets_identity
  on public.budgets (user_id, category, currency) nulls not distinct;

alter table public.budgets enable row level security;

drop policy if exists "own budgets" on public.budgets;
create policy "own budgets" on public.budgets
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
