-- vcoin 오락실 코인 시스템
-- 1) 모든 회원에게 vcoin 1000개 지급 (기존 회원 포함 — NOT NULL DEFAULT는 기존 행에도 적용됨)
alter table public.profiles add column if not exists vcoin int not null default 1000;

-- 2) 게임별 플레이 비용 (기존 게임은 1코인)
alter table public.games add column if not exists coin_cost int not null default 1;

-- 3) 코인 사용 — 원자적 차감 (잔액 부족 시 예외), 관리자는 무료
create or replace function public.spend_vcoin(p_game_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost int;
  v_balance int;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select coin_cost into v_cost from games where id = p_game_id;
  if v_cost is null then
    raise exception 'game_not_found';
  end if;

  select role into v_role from profiles where id = auth.uid();
  if v_role = 'admin' then
    select vcoin into v_balance from profiles where id = auth.uid();
    return coalesce(v_balance, 0);
  end if;

  update profiles
     set vcoin = vcoin - v_cost
   where id = auth.uid() and vcoin >= v_cost
   returning vcoin into v_balance;

  if v_balance is null then
    raise exception 'insufficient_vcoin';
  end if;

  return v_balance;
end;
$$;

grant execute on function public.spend_vcoin(uuid) to authenticated;
