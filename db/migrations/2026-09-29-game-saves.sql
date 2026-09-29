create table if not exists public.game_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  bytes integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create index if not exists game_saves_user_idx on public.game_saves (user_id, updated_at desc);

alter table public.game_saves enable row level security;

drop policy if exists "game_saves read own" on public.game_saves;
create policy "game_saves read own" on public.game_saves
  for select using (auth.uid() = user_id);

drop policy if exists "game_saves upsert own" on public.game_saves;
create policy "game_saves upsert own" on public.game_saves
  for insert with check (auth.uid() = user_id);

drop policy if exists "game_saves update own" on public.game_saves;
create policy "game_saves update own" on public.game_saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "game_saves delete own" on public.game_saves;
create policy "game_saves delete own" on public.game_saves
  for delete using (auth.uid() = user_id);
