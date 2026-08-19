-- 회원가입 약관·마케팅 동의 기록. 멱등.
alter table public.profiles add column if not exists terms_agreed_at timestamptz;
alter table public.profiles add column if not exists marketing_opt_in boolean not null default false;
alter table public.profiles add column if not exists marketing_agreed_at timestamptz;
