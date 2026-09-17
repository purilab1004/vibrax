alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('purchase','generation','refund','signup_bonus','admin_adjust','purchase_refund','chargeback','api','designer_payout','game_play','jackpot_entry','jackpot_win','ad_budget','ad_refund'));

create or replace function public.spend_credits_for_game(p_game_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost int; v_balance int; v_role text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select coin_cost into v_cost from games where id = p_game_id;
  if v_cost is null then raise exception 'game_not_found'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select coalesce(sum(amount), 0) into v_balance from credit_ledger where user_id = auth.uid();
  select role into v_role from profiles where id = auth.uid();
  if v_role = 'admin' or v_cost <= 0 then
    insert into game_coin_events (game_id, user_id, coins) values (p_game_id, auth.uid(), 0);
    return v_balance;
  end if;
  if v_balance < v_cost then raise exception 'INSUFFICIENT_CREDITS'; end if;
  insert into credit_ledger (user_id, amount, reason, ref_id) values (auth.uid(), -v_cost, 'game_play', p_game_id::text);
  insert into game_coin_events (game_id, user_id, coins) values (p_game_id, auth.uid(), v_cost);
  return v_balance - v_cost;
end;
$$;
grant execute on function public.spend_credits_for_game(uuid) to authenticated;

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
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select coalesce(sum(amount), 0) into v_balance from credit_ledger where user_id = auth.uid();
  if v_balance < v_cost then raise exception 'INSUFFICIENT_CREDITS'; end if;
  insert into credit_ledger (user_id, amount, reason, ref_id) values (auth.uid(), -v_cost, 'jackpot_entry', p_jackpot_id::text);
  insert into jackpot_entries (jackpot_id, user_id, coins) values (p_jackpot_id, auth.uid(), v_cost);
  update jackpots set pool = pool + v_cost, entries = entries + 1 where id = p_jackpot_id;
  return v_balance - v_cost;
end;
$$;
grant execute on function public.enter_jackpot(uuid) to authenticated;

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
  insert into credit_ledger (user_id, amount, reason, ref_id) values (v_winner, v_pool, 'jackpot_win', p_jackpot_id::text);
  update jackpots set status = 'drawn', winner_user_id = v_winner, drawn_at = now() where id = p_jackpot_id;
  return v_winner;
end;
$$;
grant execute on function public.settle_jackpot(uuid) to authenticated;

create or replace function public.create_ad_campaign(p_game_id uuid, p_budget int, p_cpc int, p_title text, p_creative jsonb, p_targeting jsonb, p_auto boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_budget < 10 then raise exception 'min_budget_10'; end if;
  if p_cpc < 1 then raise exception 'min_cpc_1'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select coalesce(sum(amount), 0) into v_bal from credit_ledger where user_id = auth.uid();
  if v_bal < p_budget then raise exception 'INSUFFICIENT_CREDITS'; end if;
  insert into ad_campaigns (advertiser_id, game_id, title, creative, budget_coins, cpc_coins, targeting, auto)
  values (auth.uid(), p_game_id, p_title, coalesce(p_creative, '{}'::jsonb), p_budget, p_cpc, coalesce(p_targeting, '{}'::jsonb), p_auto)
  returning id into v_id;
  insert into credit_ledger (user_id, amount, reason, ref_id) values (auth.uid(), -p_budget, 'ad_budget', v_id::text);
  return v_id;
end $$;
grant execute on function public.create_ad_campaign(uuid, int, int, text, jsonb, jsonb, boolean) to authenticated;

create or replace function public.fund_ad_campaign(p_campaign_id uuid, p_coins int)
returns int language plpgsql security definer set search_path = public as $$
declare v_bal int; v_budget int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_coins < 1 then raise exception 'min_1'; end if;
  if not exists (select 1 from ad_campaigns where id = p_campaign_id and advertiser_id = auth.uid()) then raise exception 'not_owner'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select coalesce(sum(amount), 0) into v_bal from credit_ledger where user_id = auth.uid();
  if v_bal < p_coins then raise exception 'INSUFFICIENT_CREDITS'; end if;
  insert into credit_ledger (user_id, amount, reason, ref_id) values (auth.uid(), -p_coins, 'ad_budget', p_campaign_id::text);
  update ad_campaigns set budget_coins = budget_coins + p_coins, status = case when status = 'done' then 'active' else status end, updated_at = now()
  where id = p_campaign_id returning budget_coins into v_budget;
  return v_budget;
end $$;
grant execute on function public.fund_ad_campaign(uuid, int) to authenticated;

create or replace function public.close_ad_campaign(p_campaign_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_left int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select budget_coins - spent_coins into v_left from ad_campaigns where id = p_campaign_id and advertiser_id = auth.uid();
  if v_left is null then raise exception 'not_owner'; end if;
  update ad_campaigns set status = 'done', budget_coins = spent_coins, updated_at = now() where id = p_campaign_id;
  if v_left > 0 then insert into credit_ledger (user_id, amount, reason, ref_id) values (auth.uid(), v_left, 'ad_refund', p_campaign_id::text); end if;
  return greatest(v_left, 0);
end $$;
grant execute on function public.close_ad_campaign(uuid) to authenticated;
