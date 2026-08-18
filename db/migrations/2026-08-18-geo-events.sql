-- 지도보드 — 어느 지역에서 개발/플레이가 일어나는지 (Vercel 지오 헤더 기반, IP 저장 안 함). 멱등.
create table if not exists public.geo_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- generate | publish | play | signup | visit
  user_id uuid references public.profiles(id) on delete set null,
  ref_id text,                        -- 게임/프로젝트 id
  country text, region text, city text,
  lat double precision, lon double precision,
  created_at timestamptz not null default now()
);
create index if not exists geo_events_created_idx on public.geo_events (created_at desc);
create index if not exists geo_events_kind_idx on public.geo_events (kind, created_at desc);
alter table public.geo_events enable row level security;
drop policy if exists "geo events public read" on public.geo_events;
create policy "geo events public read" on public.geo_events for select using (true);  -- 지도보드는 공개(집계만 노출)
