-- MLPilot — 프롬프트→템플릿 매핑 로그 (LLM 없이 처리한 비율 측정, 미매핑 프롬프트 학습 데이터). 멱등.
create table if not exists public.prompt_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  project_id uuid,
  prompt text not null,
  normalized text,
  template_slug text,           -- 매핑된 템플릿 (없으면 null = LLM 생성)
  method text not null,         -- keyword | similarity | manual | ml | none
  confidence real,              -- 0~1
  used_llm boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists prompt_mappings_created_idx on public.prompt_mappings (created_at desc);
create index if not exists prompt_mappings_unmapped_idx on public.prompt_mappings (used_llm, created_at desc);
alter table public.prompt_mappings enable row level security;
drop policy if exists prompt_mappings_admin on public.prompt_mappings;
create policy prompt_mappings_admin on public.prompt_mappings for all to authenticated using (public.is_admin()) with check (public.is_admin());
