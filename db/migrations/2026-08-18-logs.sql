-- 에러 로그 · 접속 로그 (관리자). 멱등.
create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'error',            -- error | warn
  source text not null default 'client',          -- client | server | api | webhook
  message text not null,
  stack text,
  path text,
  user_id uuid,
  user_agent text,
  meta jsonb,
  fingerprint text,                                -- message+path 해시 (그룹핑)
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
create index if not exists app_errors_fp_idx on public.app_errors (fingerprint, created_at desc);
alter table public.app_errors enable row level security;
drop policy if exists app_errors_admin on public.app_errors;
create policy app_errors_admin on public.app_errors for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  session_id text,                                 -- 브라우저 세션(탭) 식별자 (익명)
  user_id uuid,
  path text not null,
  referrer text,
  country text, city text,
  device text,                                     -- mobile | desktop
  browser text,                                    -- Chrome | Safari | ...
  os text,
  created_at timestamptz not null default now()
);
create index if not exists visits_created_idx on public.visits (created_at desc);
create index if not exists visits_session_idx on public.visits (session_id, created_at desc);
create index if not exists visits_user_idx on public.visits (user_id, created_at desc);
alter table public.visits enable row level security;
drop policy if exists visits_admin on public.visits;
create policy visits_admin on public.visits for select to authenticated using (public.is_admin());
