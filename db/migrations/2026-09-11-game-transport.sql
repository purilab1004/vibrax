alter table public.games add column if not exists goal_score int;
create table if not exists public.game_transports (
  id uuid primary key default gen_random_uuid(),
  from_game uuid not null,
  to_game uuid not null,
  user_id uuid,
  score int,
  goal int,
  picked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists game_transports_from_idx on public.game_transports (from_game, created_at desc);
create index if not exists game_transports_to_idx on public.game_transports (to_game, created_at desc);
alter table public.game_transports enable row level security;
drop policy if exists game_transports_insert on public.game_transports;
create policy game_transports_insert on public.game_transports for insert to authenticated with check (true);
drop policy if exists game_transports_admin on public.game_transports;
create policy game_transports_admin on public.game_transports for select to authenticated using (public.is_admin());
