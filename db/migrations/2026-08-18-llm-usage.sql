-- LLM 사용량/원가 기록 — 생성·수정·템플릿 로드·학습노트·사진레시피 등 호출마다 1행. 관리자 원가 대시보드용. 멱등.
create table if not exists public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.studio_projects(id) on delete set null,
  version_id uuid references public.studio_versions(id) on delete set null,
  kind text not null,                 -- 'create' | 'edit' | 'template' | 'template_edit' | 'explain' | 'from_image' | 'bj_chat'
  model text not null,                -- 'claude-sonnet-5' | 'claude-haiku-4-5-20251001' | 'none'
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10,6) not null default 0,   -- 정가 기준 추정 원가 (USD)
  credits int not null default 0,              -- 이 호출로 차감한 크레딧
  template_slug text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists llm_usage_created_at on public.llm_usage (created_at desc);
create index if not exists llm_usage_user on public.llm_usage (user_id);
alter table public.llm_usage enable row level security;
-- 쓰기는 service role, 읽기는 관리자만
drop policy if exists "llm_usage admin read" on public.llm_usage;
create policy "llm_usage admin read" on public.llm_usage for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
