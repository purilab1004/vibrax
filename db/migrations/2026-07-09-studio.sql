-- db/migrations/2026-07-09-studio.sql
-- Studio: 프롬프트 게임 제작 프로젝트/채팅/버전 + 크레딧 원장.
-- 잔액은 credit_ledger 합산으로만 계산. 클라이언트는 credit_ledger에 INSERT 불가 —
-- 쓰기는 SECURITY DEFINER 함수(spend/refund/bonus)와 service role(웹훅 지급)만.

create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  title text not null default '새 게임',
  created_at timestamptz default now()
);

create table if not exists public.studio_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);

create table if not exists public.studio_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  version int not null,
  html text not null,
  created_at timestamptz default now(),
  unique (project_id, version)
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount int not null,
  reason text not null check (reason in ('purchase','generation','refund','signup_bonus')),
  ref_id text,
  created_at timestamptz default now()
);

-- 중복 방지: 결제 이중 지급 / 가입 보너스 중복 / 이중 환불
create unique index if not exists credit_ledger_purchase_ref
  on public.credit_ledger (ref_id) where reason = 'purchase';
create unique index if not exists credit_ledger_signup_once
  on public.credit_ledger (user_id) where reason = 'signup_bonus';
create unique index if not exists credit_ledger_refund_ref
  on public.credit_ledger (ref_id) where reason = 'refund';

alter table public.games
  add column if not exists studio_project_id uuid references public.studio_projects(id);

alter table public.studio_projects enable row level security;
alter table public.studio_messages enable row level security;
alter table public.studio_versions enable row level security;
alter table public.credit_ledger enable row level security;

create policy "own projects select" on public.studio_projects
  for select using (user_id = auth.uid());
create policy "own projects insert" on public.studio_projects
  for insert with check (user_id = auth.uid());
create policy "own projects update" on public.studio_projects
  for update using (user_id = auth.uid());
create policy "own projects delete" on public.studio_projects
  for delete using (user_id = auth.uid());

create policy "own messages select" on public.studio_messages for select
  using (exists (select 1 from public.studio_projects p
                 where p.id = project_id and p.user_id = auth.uid()));
create policy "own messages insert" on public.studio_messages for insert
  with check (exists (select 1 from public.studio_projects p
                      where p.id = project_id and p.user_id = auth.uid()));

create policy "own versions select" on public.studio_versions for select
  using (exists (select 1 from public.studio_projects p
                 where p.id = project_id and p.user_id = auth.uid()));
create policy "own versions insert" on public.studio_versions for insert
  with check (exists (select 1 from public.studio_projects p
                      where p.id = project_id and p.user_id = auth.uid()));

-- 원장: 본인 조회만. INSERT/UPDATE/DELETE 정책 없음(= 함수/service role 외 차단)
create policy "own ledger select" on public.credit_ledger
  for select using (user_id = auth.uid());

create or replace function public.credit_balance() returns int
language sql security definer set search_path = public as
$$ select coalesce(sum(amount), 0)::int from credit_ledger where user_id = auth.uid() $$;

-- 원자적 차감: 사용자별 advisory lock으로 동시 요청에도 음수 잔액 불가
create or replace function public.spend_credits(p_amount int, p_ref text) returns int
language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select coalesce(sum(amount), 0) into v_balance
    from credit_ledger where user_id = auth.uid();
  if v_balance < p_amount then raise exception 'INSUFFICIENT_CREDITS'; end if;
  insert into credit_ledger (user_id, amount, reason, ref_id)
    values (auth.uid(), -p_amount, 'generation', p_ref);
  return v_balance - p_amount;
end $$;

-- 환불: 같은 ref의 차감 건이 있어야만 지급(임의 호출로 크레딧 생성 불가),
-- credit_ledger_refund_ref 인덱스가 이중 환불 차단
create or replace function public.refund_credits(p_amount int, p_ref text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from credit_ledger
                 where user_id = auth.uid() and reason = 'generation'
                   and ref_id = p_ref and amount = -p_amount) then
    raise exception 'NO_MATCHING_SPEND';
  end if;
  insert into credit_ledger (user_id, amount, reason, ref_id)
    values (auth.uid(), p_amount, 'refund', p_ref);
end $$;

-- 가입 보너스 30크레딧 1회 지급, 항상 현재 잔액 반환
create or replace function public.grant_signup_bonus() returns int
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  insert into credit_ledger (user_id, amount, reason)
    values (auth.uid(), 30, 'signup_bonus')
    on conflict (user_id) where reason = 'signup_bonus' do nothing;
  return (select coalesce(sum(amount), 0)::int
            from credit_ledger where user_id = auth.uid());
end $$;

grant execute on function public.credit_balance() to authenticated;
grant execute on function public.spend_credits(int, text) to authenticated;
grant execute on function public.refund_credits(int, text) to authenticated;
grant execute on function public.grant_signup_bonus() to authenticated;
