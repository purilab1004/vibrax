-- 스튜디오 템플릿 라이브러리(DB) — 처음 만들어진 게임을 후보로 저장 → 관리자 승인 시 이후 같은 요청은 LLM 없이 재사용. 멱등.
create table if not exists public.studio_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  keywords text[] not null default '{}',
  prompt text not null,
  description text,
  html text not null,
  approved boolean not null default false,
  uses int not null default 0,
  source_project_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_templates_approved_idx on public.studio_templates (approved, created_at desc);
alter table public.studio_templates enable row level security;
drop policy if exists studio_templates_admin on public.studio_templates;
create policy studio_templates_admin on public.studio_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
