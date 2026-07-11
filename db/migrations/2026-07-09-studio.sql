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

-- 프로젝트당 게시 1회 (동시 게시 레이스 차단)
create unique index if not exists games_studio_project_unique
  on public.games (studio_project_id) where studio_project_id is not null;

-- 게시 소유권 검증: games 행의 user_id가 해당 studio 프로젝트의 소유자여야 함
-- (FK는 RLS를 우회하므로 games INSERT만으로는 타인의 비공개 프로젝트를
-- studio_project_id로 지정해 게시할 수 있음 — 별도 permissive 정책 추가는
-- 접근 범위만 넓히므로 트리거로 차단한다)
create or replace function public.check_studio_project_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.studio_project_id is not null and not exists (
    select 1 from studio_projects p
    where p.id = new.studio_project_id and p.user_id = new.user_id
  ) then
    raise exception 'NOT_PROJECT_OWNER';
  end if;
  return new;
end $$;

drop trigger if exists games_studio_project_owner on public.games;
create trigger games_studio_project_owner
  before insert or update on public.games
  for each row execute function public.check_studio_project_owner();

alter table public.studio_projects enable row level security;
alter table public.studio_messages enable row level security;
alter table public.studio_versions enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists "own projects select" on public.studio_projects;
create policy "own projects select" on public.studio_projects
  for select using (user_id = auth.uid());
drop policy if exists "own projects insert" on public.studio_projects;
create policy "own projects insert" on public.studio_projects
  for insert with check (user_id = auth.uid());
drop policy if exists "own projects update" on public.studio_projects;
create policy "own projects update" on public.studio_projects
  for update using (user_id = auth.uid());
drop policy if exists "own projects delete" on public.studio_projects;
create policy "own projects delete" on public.studio_projects
  for delete using (user_id = auth.uid());

drop policy if exists "own messages select" on public.studio_messages;
create policy "own messages select" on public.studio_messages for select
  using (exists (select 1 from public.studio_projects p
                 where p.id = project_id and p.user_id = auth.uid()));
drop policy if exists "own messages insert" on public.studio_messages;
create policy "own messages insert" on public.studio_messages for insert
  with check (exists (select 1 from public.studio_projects p
                      where p.id = project_id and p.user_id = auth.uid()));

drop policy if exists "own versions select" on public.studio_versions;
create policy "own versions select" on public.studio_versions for select
  using (exists (select 1 from public.studio_projects p
                 where p.id = project_id and p.user_id = auth.uid()));
drop policy if exists "own versions insert" on public.studio_versions;
create policy "own versions insert" on public.studio_versions for insert
  with check (exists (select 1 from public.studio_projects p
                      where p.id = project_id and p.user_id = auth.uid()));

-- 원장: 본인 조회만. INSERT/UPDATE/DELETE 정책 없음(= 함수/service role 외 차단)
drop policy if exists "own ledger select" on public.credit_ledger;
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
-- credit_ledger_refund_ref 인덱스가 이중 환불 차단.
-- authenticated에는 부여하지 않음(자기 자신 대상 환불이라도 클라이언트가 직접
-- 호출하면 임의 성공 건을 조회해 환불을 청구할 수 있음) — service role 전용,
-- 호출자는 반드시 서버에서 검증된 p_user_id를 넘긴다.
create or replace function public.refund_credits(p_user_id uuid, p_amount int, p_ref text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is null then raise exception 'INVALID_USER'; end if;
  if not exists (select 1 from credit_ledger
                 where user_id = p_user_id and reason = 'generation'
                   and ref_id = p_ref and amount = -p_amount) then
    raise exception 'NO_MATCHING_SPEND';
  end if;
  insert into credit_ledger (user_id, amount, reason, ref_id)
    values (p_user_id, p_amount, 'refund', p_ref);
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
grant execute on function public.grant_signup_bonus() to authenticated;

-- refund_credits는 서버(서비스 롤)에서 검증된 p_user_id로만 호출한다.
-- authenticated에 부여하면 사용자가 자신의 ledger에서 ref_id를 읽어
-- 브라우저에서 직접 RPC를 호출해 성공한 생성 건을 임의로 환불(크레딧 편취)할 수 있다.
revoke all on function public.refund_credits(uuid, int, text) from public;
grant execute on function public.refund_credits(uuid, int, text) to service_role;
