-- 자동화 처리 내역 (AI/규칙이 관리자 대신 처리한 것) — 사람 체크 대시보드용. 멱등.
create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  module text not null,          -- templates | mlpilot | tokenpilot | adpilot | blog | aj | payments | broadcasts | security
  action text not null,
  target text,
  status text not null default 'ok',   -- ok | error | needs_review
  detail jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists automation_logs_created_idx on public.automation_logs (created_at desc);
create index if not exists automation_logs_status_idx on public.automation_logs (status, created_at desc);
alter table public.automation_logs enable row level security;
drop policy if exists automation_logs_admin on public.automation_logs;
create policy automation_logs_admin on public.automation_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());
