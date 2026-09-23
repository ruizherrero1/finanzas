-- FinanceLab: one private workspace; no user can self-enrol or change its owner.
create table public.finance_workspace (
  singleton boolean primary key default true check (singleton),
  owner_id uuid not null unique references auth.users(id) on delete restrict,
  watchlist text[] not null default '{}',
  ideas jsonb not null default '[]'::jsonb check(jsonb_typeof(ideas)='array'),
  updated_at timestamptz not null default now()
);
alter table public.finance_workspace enable row level security;
revoke all on public.finance_workspace from anon, authenticated;
grant select on public.finance_workspace to authenticated;
grant update (watchlist, ideas, updated_at) on public.finance_workspace to authenticated;
create policy finance_owner_read on public.finance_workspace for select to authenticated
  using(owner_id = (select auth.uid()));
create policy finance_owner_update on public.finance_workspace for update to authenticated
  using(owner_id = (select auth.uid())) with check(owner_id = (select auth.uid()));
-- Provision the one owner separately, through an authenticated administrator.
