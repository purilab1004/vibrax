-- 약관 관리 — 버전별 저장, 게시본만 사이트에 노출. 멱등.
create table if not exists public.legal_docs (
  id uuid primary key default gen_random_uuid(),
  key text not null,              -- terms | privacy | refund | marketing
  lang text not null default 'ko',
  version int not null default 1,
  title text not null,
  updated text,                   -- "시행일: 2026년 8월 19일" 표시 문구
  sections jsonb not null,        -- [{h, p:[...]}]
  published boolean not null default false,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (key, lang, version)
);
alter table public.legal_docs enable row level security;
drop policy if exists legal_docs_public_read on public.legal_docs;
create policy legal_docs_public_read on public.legal_docs for select using (published = true or public.is_admin());
drop policy if exists legal_docs_admin_write on public.legal_docs;
create policy legal_docs_admin_write on public.legal_docs for all to authenticated using (public.is_admin()) with check (public.is_admin());
