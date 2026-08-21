create table if not exists public.aj_bot_curriculum (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  step_order int not null default 100,
  name text not null,
  hint text not null,
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.aj_bot_curriculum enable row level security;
drop policy if exists aj_bot_curriculum_admin on public.aj_bot_curriculum;
create policy aj_bot_curriculum_admin on public.aj_bot_curriculum for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.aj_learn_log (
  id uuid primary key default gen_random_uuid(),
  game_id uuid,
  user_id uuid not null,
  kind text not null,
  title text not null,
  detail text,
  version int,
  created_at timestamptz not null default now()
);
create index if not exists aj_learn_log_user_idx on public.aj_learn_log (user_id, created_at desc);
alter table public.aj_learn_log enable row level security;
drop policy if exists aj_learn_log_own on public.aj_learn_log;
create policy aj_learn_log_own on public.aj_learn_log for select to authenticated using (user_id = auth.uid() or public.is_admin());

alter table public.aj_play_policies add column if not exists last_skill_at timestamptz;
alter table public.aj_bot_curriculum add column if not exists game_id uuid;
create index if not exists aj_bot_curriculum_game_idx on public.aj_bot_curriculum (game_id) where game_id is not null;
