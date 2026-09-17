-- 코인 잭팟 v2 — 잭팟별 상품(조건 금액 초과 시 지급) + 당첨자 수 + 당첨자 목록(관리자가 직접 상금 수여)
--  · 추첨(settle_jackpot)은 더 이상 크레딧을 자동 지급하지 않는다 → jackpot_winners 에 당첨자만 기록
--  · 관리자가 당첨자 목록에서 크레딧 지급(credit_ledger 'jackpot_win') 또는 상품 지급 완료 처리
--  · 취소 시 참여 크레딧 환불은 credit_ledger 'jackpot_refund'
alter table public.jackpots add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.jackpots add column if not exists product_threshold int not null default 0;
alter table public.jackpots add column if not exists winner_count int not null default 1;
alter table public.jackpots drop constraint if exists jackpots_winner_count_check;
alter table public.jackpots add constraint jackpots_winner_count_check check (winner_count between 1 and 100);

create table if not exists public.jackpot_winners (
  id uuid primary key default gen_random_uuid(),
  jackpot_id uuid not null references public.jackpots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank int not null default 1,
  amount int not null default 0,
  prize text not null default 'credits' check (prize in ('credits','product')),
  awarded boolean not null default false,
  awarded_at timestamptz,
  awarded_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);
alter table public.jackpot_winners add column if not exists awarded_by uuid references public.profiles(id);
create index if not exists jackpot_winners_jackpot_idx on public.jackpot_winners (jackpot_id, rank);
alter table public.jackpot_winners enable row level security;
drop policy if exists jackpot_winners_read on public.jackpot_winners;
create policy jackpot_winners_read on public.jackpot_winners for select using (true);

alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('purchase','generation','refund','signup_bonus','admin_adjust','purchase_refund','chargeback','api','designer_payout','game_play','jackpot_entry','jackpot_win','jackpot_refund','ad_budget','ad_refund'));

-- 반환 타입이 uuid → int 로 바뀌므로 먼저 지운다
drop function if exists public.settle_jackpot(uuid);
create or replace function public.settle_jackpot(p_jackpot_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool int; v_status text; v_n int; v_threshold int; v_product uuid; v_total int; v_pick int; v_acc int;
  v_winner uuid; v_share int; v_count int := 0; v_prize text; v_users int; r record; v_picked uuid[] := '{}';
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select pool, status, coalesce(winner_count, 1), coalesce(product_threshold, 0), product_id
    into v_pool, v_status, v_n, v_threshold, v_product from jackpots where id = p_jackpot_id for update;
  if v_pool is null then raise exception 'jackpot_not_found'; end if;
  if v_status <> 'open' then raise exception 'already_settled'; end if;
  select coalesce(sum(coins), 0), count(distinct user_id) into v_total, v_users from jackpot_entries where jackpot_id = p_jackpot_id;
  if v_total <= 0 then
    update jackpots set status = 'cancelled', drawn_at = now() where id = p_jackpot_id;
    return 0;
  end if;
  -- 상품이 걸려 있고 모인 금액이 조건 금액을 넘으면 상품, 아니면 크레딧
  v_prize := case when v_product is not null and v_pool > v_threshold then 'product' else 'credits' end;
  v_n := greatest(1, least(v_n, v_users));   -- 참여자(중복 제외)보다 많이 뽑지 않는다
  v_share := floor(v_pool / v_n);
  -- 낸 크레딧만큼의 가중 랜덤, 한 회원은 한 번만 당첨
  while v_count < v_n loop
    select coalesce(sum(coins), 0) into v_total from jackpot_entries where jackpot_id = p_jackpot_id and not (user_id = any(v_picked));
    exit when v_total <= 0;
    v_pick := floor(random() * v_total)::int; v_acc := 0; v_winner := null;
    for r in select user_id, coins from jackpot_entries where jackpot_id = p_jackpot_id and not (user_id = any(v_picked)) order by created_at loop
      v_acc := v_acc + r.coins;
      if v_pick < v_acc then v_winner := r.user_id; exit; end if;
    end loop;
    exit when v_winner is null;
    v_picked := array_append(v_picked, v_winner); v_count := v_count + 1;
    insert into jackpot_winners (jackpot_id, user_id, rank, amount, prize) values (p_jackpot_id, v_winner, v_count, v_share, v_prize);
  end loop;
  update jackpots set status = 'drawn', winner_user_id = v_picked[1], drawn_at = now() where id = p_jackpot_id;
  return v_count;
end;
$$;
grant execute on function public.settle_jackpot(uuid) to authenticated;
