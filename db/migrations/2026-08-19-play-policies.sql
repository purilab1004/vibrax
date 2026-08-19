create table if not exists public.aj_play_policies (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  version int not null default 1,
  tips text[] not null default '{}',
  rules jsonb not null default '[]',
  params jsonb not null default '{}',
  summary text,
  best_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, user_id)
);
alter table public.aj_play_policies enable row level security;
drop policy if exists aj_play_policies_own on public.aj_play_policies;
create policy aj_play_policies_own on public.aj_play_policies for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
alter table public.aj_play_policies add column if not exists episodes jsonb not null default '[]';
alter table public.aj_play_policies add column if not exists auto_learn boolean not null default true;
alter table public.aj_play_policies add column if not exists best_rules jsonb;
alter table public.aj_play_policies add column if not exists best_avg real;
alter table public.aj_play_policies add column if not exists auto_count int not null default 0;
