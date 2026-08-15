-- 토너먼트 참가 신청 — 회원가입 기반 (로그인한 회원만 신청 가능). 멱등.
create table if not exists public.tournament_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  division text not null check (division in ('individual','school','world','company')),
  name text not null,
  email text not null,
  country text,
  school_level text check (school_level in ('elementary','middle','high','university')),
  school_name text,
  company_name text,
  note text,
  created_at timestamptz not null default now(),
  -- 부문당 1회 신청
  unique (user_id, division)
);
alter table public.tournament_applications enable row level security;
drop policy if exists tournament_applications_insert on public.tournament_applications;
create policy tournament_applications_insert on public.tournament_applications
  for insert with check (user_id = auth.uid());
-- 본인 신청 내역 확인 + 관리자 전체 열람
drop policy if exists tournament_applications_select on public.tournament_applications;
create policy tournament_applications_select on public.tournament_applications
  for select using (user_id = auth.uid() or public.is_admin());
