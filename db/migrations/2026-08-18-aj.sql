-- AJ Brain v1 — 게임 플레이 텔레메트리 · 코인 수익 원장 · AJ 리포트. 멱등.

-- 1) 플레이 세션 (게임 iframe 열림~닫힘). 게임 안 이벤트(AJ.event)로 점수/게임오버/첫 게임오버 시각을 채운다.
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec int not null default 0,
  score_max int,
  game_overs int not null default 0,
  first_over_sec int,          -- 시작 후 첫 게임오버까지 초 (초반 이탈/난이도 지표)
  events int not null default 0, -- 받은 게임 이벤트 수 (0 이면 텔레메트리 미지원 게임)
  device text                  -- 'mobile' | 'desktop'
);
create index if not exists game_sessions_game_started on public.game_sessions (game_id, started_at desc);
alter table public.game_sessions enable row level security;
drop policy if exists "sessions insert own" on public.game_sessions;
create policy "sessions insert own" on public.game_sessions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "sessions update own" on public.game_sessions;
create policy "sessions update own" on public.game_sessions for update to authenticated using (auth.uid() = user_id);
drop policy if exists "sessions read owner or admin" on public.game_sessions;
create policy "sessions read owner or admin" on public.game_sessions for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from public.games g where g.id = game_id and g.user_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 2) 코인 원장 — 게임별 수익. spend_vcoin 이 차감할 때 함께 기록한다.
create table if not exists public.game_coin_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  coins int not null,
  created_at timestamptz not null default now()
);
create index if not exists game_coin_events_game_created on public.game_coin_events (game_id, created_at desc);
alter table public.game_coin_events enable row level security;
drop policy if exists "coin events public read" on public.game_coin_events;
create policy "coin events public read" on public.game_coin_events for select using (true); -- AJ 랭킹(공개)에서 집계

create or replace function public.spend_vcoin(p_game_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost int;
  v_balance int;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select coin_cost into v_cost from games where id = p_game_id;
  if v_cost is null then
    raise exception 'game_not_found';
  end if;
  select role into v_role from profiles where id = auth.uid();
  if v_role = 'admin' then
    select vcoin into v_balance from profiles where id = auth.uid();
    insert into game_coin_events (game_id, user_id, coins) values (p_game_id, auth.uid(), 0);
    return coalesce(v_balance, 0);
  end if;
  update profiles set vcoin = vcoin - v_cost where id = auth.uid() and vcoin >= v_cost returning vcoin into v_balance;
  if v_balance is null then
    raise exception 'insufficient_vcoin';
  end if;
  insert into game_coin_events (game_id, user_id, coins) values (p_game_id, auth.uid(), v_cost);
  return v_balance;
end;
$$;
grant execute on function public.spend_vcoin(uuid) to authenticated;

-- 3) AJ 리포트 (게임 분석·개선 제안·방송/성장/수익 아이디어)
create table if not exists public.aj_reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  metrics jsonb not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists aj_reports_game_created on public.aj_reports (game_id, created_at desc);
alter table public.aj_reports enable row level security;
drop policy if exists "aj reports public read" on public.aj_reports;
create policy "aj reports public read" on public.aj_reports for select using (true);
