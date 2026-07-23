-- 파트너 신청 (비회원도 문의 가능한 B2B 인바운드). 멱등.
create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  org_type text not null check (org_type in ('school','company','organization','institution','other')),
  org_name text not null,
  contact_name text not null,
  email text not null,
  website text,
  message text,
  created_at timestamptz not null default now()
);
alter table public.partner_applications enable row level security;
drop policy if exists partner_applications_insert on public.partner_applications;
create policy partner_applications_insert on public.partner_applications
  for insert with check (true);
-- 열람은 관리자만
drop policy if exists partner_applications_select on public.partner_applications;
create policy partner_applications_select on public.partner_applications
  for select using (public.is_admin());
