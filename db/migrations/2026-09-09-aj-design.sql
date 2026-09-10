-- AJ 자율 게임 디자이너 루프 — 카나리 실험 (docs/plan 16장)
-- 리포트 제안 → 자동 수정 버전 → 세션 20% 카나리 → 지표 비교 → 채택/복귀. 멱등.

-- 1) 버전 출처 (user | auto) + 실험 연결
alter table public.studio_versions add column if not exists origin text not null default 'user';
alter table public.studio_versions add column if not exists experiment_id uuid;

-- 2) 게임별 라이브/카나리 버전 포인터 + opt-in
alter table public.games add column if not exists live_version_id uuid;
alter table public.games add column if not exists canary_version_id uuid;
alter table public.games add column if not exists canary_ratio real not null default 0.2;
alter table public.games add column if not exists auto_design boolean not null default false;

-- 3) 세션에 서빙된 버전 꼬리표
alter table public.game_sessions add column if not exists version_id uuid;
create index if not exists game_sessions_version_idx on public.game_sessions (game_id, version_id, started_at desc);

-- 4) 실험 테이블
create table if not exists public.aj_experiments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  project_id uuid not null,
  base_version_id uuid,
  candidate_version_id uuid,
  hypothesis jsonb not null default '{}'::jsonb,   -- {title, why, prompt, impact}
  status text not null default 'proposed' check (status in ('proposed','generating','canary','adopted','reverted','failed','vetoed','inconclusive')),
  metrics_a jsonb,
  metrics_b jsonb,
  score real,
  cost_usd numeric(10,6) not null default 0,
  note text,
  started_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists aj_experiments_game_idx on public.aj_experiments (game_id, created_at desc);
create index if not exists aj_experiments_status_idx on public.aj_experiments (status) where status = 'canary';

alter table public.aj_experiments enable row level security;
drop policy if exists aj_experiments_owner_read on public.aj_experiments;
create policy aj_experiments_owner_read on public.aj_experiments for select
  using (public.is_admin() or exists (select 1 from public.games g where g.id = aj_experiments.game_id and g.user_id = auth.uid()));
-- 쓰기는 service role 전용 (정책 없음)

-- 5) 학습 로그 종류에 design 추가 (kind 가 check 로 묶여 있으면 완화)
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'aj_learn_log_kind_check') then
    alter table public.aj_learn_log drop constraint aj_learn_log_kind_check;
  end if;
end $$;
