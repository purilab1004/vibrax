-- ─────────────────────────────────────────────────────────────────────────────
-- 1) 코인 잭팟(랜덤 뽑기) — 관리자가 만들고, 회원은 코인을 내고 참여, 마감 후 추첨 → 당첨자가 모인 코인을 모두 가져간다
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.jackpots (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  entry_cost int not null default 50 check (entry_cost > 0),
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open','drawn','cancelled')),
  pool int not null default 0,
  entries int not null default 0,
  winner_user_id uuid references public.profiles(id),
  drawn_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.jackpot_entries (
  id uuid primary key default gen_random_uuid(),
  jackpot_id uuid not null references public.jackpots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  coins int not null,
  created_at timestamptz not null default now()
);
create index if not exists jackpot_entries_jackpot_idx on public.jackpot_entries (jackpot_id, created_at);
create index if not exists jackpot_entries_user_idx on public.jackpot_entries (user_id);

-- 코인으로 살 수 있는 실제 상품 (이미지 등록) — 잭팟 카드·라이브러리에 표시
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  coin_price int not null default 0,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.jackpots enable row level security;
alter table public.jackpot_entries enable row level security;
alter table public.products enable row level security;
drop policy if exists jackpots_read on public.jackpots;
create policy jackpots_read on public.jackpots for select using (true);
drop policy if exists jackpot_entries_read_own on public.jackpot_entries;
create policy jackpot_entries_read_own on public.jackpot_entries for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (active = true or public.is_admin());

-- 참여: 코인 차감 + 참여 기록 + 풀 누적 (원자적)
create or replace function public.enter_jackpot(p_jackpot_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost int; v_status text; v_ends timestamptz; v_balance int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select entry_cost, status, ends_at into v_cost, v_status, v_ends from jackpots where id = p_jackpot_id for update;
  if v_cost is null then raise exception 'jackpot_not_found'; end if;
  if v_status <> 'open' or v_ends <= now() then raise exception 'jackpot_closed'; end if;
  update profiles set vcoin = vcoin - v_cost where id = auth.uid() and vcoin >= v_cost returning vcoin into v_balance;
  if v_balance is null then raise exception 'insufficient_vcoin'; end if;
  insert into jackpot_entries (jackpot_id, user_id, coins) values (p_jackpot_id, auth.uid(), v_cost);
  update jackpots set pool = pool + v_cost, entries = entries + 1 where id = p_jackpot_id;
  return v_balance;
end;
$$;
grant execute on function public.enter_jackpot(uuid) to authenticated;

-- 추첨(관리자): 낸 코인만큼 가중 랜덤으로 당첨자를 뽑고 풀 전체를 지급
create or replace function public.settle_jackpot(p_jackpot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool int; v_status text; v_total int; v_pick int; v_acc int := 0; v_winner uuid; r record;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select pool, status into v_pool, v_status from jackpots where id = p_jackpot_id for update;
  if v_pool is null then raise exception 'jackpot_not_found'; end if;
  if v_status <> 'open' then raise exception 'already_settled'; end if;
  select coalesce(sum(coins), 0) into v_total from jackpot_entries where jackpot_id = p_jackpot_id;
  if v_total <= 0 then
    update jackpots set status = 'cancelled', drawn_at = now() where id = p_jackpot_id;
    return null;
  end if;
  v_pick := floor(random() * v_total)::int;
  for r in select user_id, coins from jackpot_entries where jackpot_id = p_jackpot_id order by created_at loop
    v_acc := v_acc + r.coins;
    if v_pick < v_acc then v_winner := r.user_id; exit; end if;
  end loop;
  update profiles set vcoin = vcoin + v_pool where id = v_winner;
  update jackpots set status = 'drawn', winner_user_id = v_winner, drawn_at = now() where id = p_jackpot_id;
  return v_winner;
end;
$$;
grant execute on function public.settle_jackpot(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) 게임 디자이너 — 회원 직분 'designer', 접수, 디자이너 업로드(승인 대기 → 공개)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user','admin','designer'));

create table if not exists public.designer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  email text not null,
  portfolio_url text,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index if not exists designer_applications_user_idx on public.designer_applications (user_id, created_at desc);
alter table public.designer_applications enable row level security;
drop policy if exists designer_applications_own on public.designer_applications;
create policy designer_applications_own on public.designer_applications for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- 미디어 에셋: 디자이너 업로드는 'pending' 으로 들어와 관리자가 승인하면 'active'(공개)
alter table public.media_assets drop constraint if exists media_assets_status_check;
alter table public.media_assets add constraint media_assets_status_check check (status in ('active','archived','pending','rejected'));
alter table public.media_assets add column if not exists designer_id uuid references public.profiles(id);
alter table public.media_assets add column if not exists credit_earned int not null default 0; -- 이 에셋으로 디자이너에게 쌓인 크레딧(100%)
create index if not exists media_assets_designer_idx on public.media_assets (designer_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) 디자이너 보상 — 회원이 디자이너 에셋을 써서 게임을 생성하면 그 생성 크레딧이 100% 디자이너에게 쌓인다 (credit_ledger reason 'designer_payout')
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('purchase','generation','refund','signup_bonus','admin_adjust','purchase_refund','chargeback','designer_payout'));
