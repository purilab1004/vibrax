-- AJ AdPilot — 게임 홍보 캠페인(의뢰) · 노출/클릭/전환 이벤트 · 코인 예산. 멱등.

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.profiles(id) on delete cascade,  -- 의뢰인(예산 지불)
  game_id uuid not null references public.games(id) on delete cascade,
  title text,
  creative jsonb not null default '{}'::jsonb,   -- {headline, hook, badge, thumbnail_title, by:'aj'|'user'}
  budget_coins int not null default 0,
  spent_coins int not null default 0,
  cpc_coins int not null default 1,              -- 클릭당 코인 (입찰가)
  status text not null default 'active' check (status in ('active','paused','done','rejected')),
  targeting jsonb not null default '{}'::jsonb,  -- {genres:[], countries:[]}
  auto boolean not null default false,           -- AJ 자동 운영(리인베스트)
  impressions int not null default 0,
  clicks int not null default 0,
  plays int not null default 0,
  coins_earned int not null default 0,           -- 캠페인 유입 플레이로 벌어들인 코인(귀속)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ad_campaigns_status_idx on public.ad_campaigns (status, created_at desc);
create index if not exists ad_campaigns_adv_idx on public.ad_campaigns (advertiser_id, created_at desc);
alter table public.ad_campaigns enable row level security;
drop policy if exists ad_campaigns_select on public.ad_campaigns;
create policy ad_campaigns_select on public.ad_campaigns for select to authenticated using (advertiser_id = auth.uid() or public.is_admin());
drop policy if exists ad_campaigns_update on public.ad_campaigns;
create policy ad_campaigns_update on public.ad_campaigns for update to authenticated using (advertiser_id = auth.uid() or public.is_admin());

create table if not exists public.ad_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  kind text not null check (kind in ('impression','click','play','coin')),
  user_id uuid,
  coins int not null default 0,
  country text,
  created_at timestamptz not null default now()
);
create index if not exists ad_events_campaign_idx on public.ad_events (campaign_id, created_at desc);
alter table public.ad_events enable row level security;
drop policy if exists ad_events_select on public.ad_events;
create policy ad_events_select on public.ad_events for select to authenticated using (
  public.is_admin() or exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.advertiser_id = auth.uid())
);

-- 캠페인 생성 + 예산 충전 (의뢰인의 vcoin 에서 차감). 잔액 부족이면 예외.
create or replace function public.create_ad_campaign(p_game_id uuid, p_budget int, p_cpc int, p_title text, p_creative jsonb, p_targeting jsonb, p_auto boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_budget < 10 then raise exception 'min_budget_10'; end if;
  if p_cpc < 1 then raise exception 'min_cpc_1'; end if;
  update profiles set vcoin = vcoin - p_budget where id = auth.uid() and vcoin >= p_budget returning vcoin into v_bal;
  if v_bal is null then raise exception 'insufficient_vcoin'; end if;
  insert into ad_campaigns (advertiser_id, game_id, title, creative, budget_coins, cpc_coins, targeting, auto)
  values (auth.uid(), p_game_id, p_title, coalesce(p_creative, '{}'::jsonb), p_budget, p_cpc, coalesce(p_targeting, '{}'::jsonb), p_auto)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.create_ad_campaign(uuid, int, int, text, jsonb, jsonb, boolean) to authenticated;

-- 예산 추가 충전
create or replace function public.fund_ad_campaign(p_campaign_id uuid, p_coins int)
returns int language plpgsql security definer set search_path = public as $$
declare v_bal int; v_budget int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_coins < 1 then raise exception 'min_1'; end if;
  if not exists (select 1 from ad_campaigns where id = p_campaign_id and advertiser_id = auth.uid()) then raise exception 'not_owner'; end if;
  update profiles set vcoin = vcoin - p_coins where id = auth.uid() and vcoin >= p_coins returning vcoin into v_bal;
  if v_bal is null then raise exception 'insufficient_vcoin'; end if;
  update ad_campaigns set budget_coins = budget_coins + p_coins, status = case when status = 'done' then 'active' else status end, updated_at = now()
  where id = p_campaign_id returning budget_coins into v_budget;
  return v_budget;
end $$;
grant execute on function public.fund_ad_campaign(uuid, int) to authenticated;

-- 캠페인 중지 시 남은 예산 환불
create or replace function public.close_ad_campaign(p_campaign_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_left int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select budget_coins - spent_coins into v_left from ad_campaigns where id = p_campaign_id and advertiser_id = auth.uid();
  if v_left is null then raise exception 'not_owner'; end if;
  update ad_campaigns set status = 'done', budget_coins = spent_coins, updated_at = now() where id = p_campaign_id;
  if v_left > 0 then update profiles set vcoin = vcoin + v_left where id = auth.uid(); end if;
  return greatest(v_left, 0);
end $$;
grant execute on function public.close_ad_campaign(uuid) to authenticated;
