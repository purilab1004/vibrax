-- 공유한 게임 기록 — 내 페이지 "공유한 게임" 모아보기용. 멱등.
create table if not exists public.game_shares (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);
alter table public.game_shares enable row level security;
drop policy if exists "game_shares own read" on public.game_shares;
create policy "game_shares own read" on public.game_shares for select to authenticated using (auth.uid() = user_id);
drop policy if exists "game_shares own insert" on public.game_shares;
create policy "game_shares own insert" on public.game_shares for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "game_shares own delete" on public.game_shares;
create policy "game_shares own delete" on public.game_shares for delete to authenticated using (auth.uid() = user_id);
