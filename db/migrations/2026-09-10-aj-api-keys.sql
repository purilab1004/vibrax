/* AJ 외부 API - 회원별 API 키. 멱등. 키 원문은 저장하지 않고 sha256 해시만 저장. */

create table if not exists public.aj_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'default',
  prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['chat','profile','tts'],
  calls_total bigint not null default 0,
  calls_today int not null default 0,
  calls_day date,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists aj_api_keys_user_idx on public.aj_api_keys (user_id, created_at desc);

alter table public.aj_api_keys enable row level security;
drop policy if exists aj_api_keys_owner_read on public.aj_api_keys;
create policy aj_api_keys_owner_read on public.aj_api_keys for select using (user_id = auth.uid() or public.is_admin());
/* 호출 1건 기록 + 일일 할당량 검사. service role 전용. */
create or replace function public.aj_api_hit(p_key uuid, p_daily_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare v_today int;
begin
  update public.aj_api_keys
     set calls_today = case when calls_day = current_date then calls_today + 1 else 1 end,
         calls_day = current_date,
         calls_total = calls_total + 1,
         last_used_at = now()
   where id = p_key and revoked_at is null
   returning calls_today into v_today;
  if v_today is null then raise exception 'KEY_NOT_FOUND'; end if;
  if v_today > p_daily_limit then raise exception 'QUOTA_EXCEEDED'; end if;
  return v_today;
end $$;
revoke all on function public.aj_api_hit(uuid, int) from public, anon, authenticated;
grant execute on function public.aj_api_hit(uuid, int) to service_role;

/* 키 종류: chrome(무료) | api(유료) */
alter table public.aj_api_keys add column if not exists kind text not null default 'api' check (kind in ('chrome','api'));
create index if not exists aj_api_keys_user_kind_idx on public.aj_api_keys (user_id, kind) where revoked_at is null;

/* credit_ledger reason 에 api 추가 */
alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('purchase','generation','refund','signup_bonus','admin_adjust','purchase_refund','chargeback','api'));

/* API 과금용 크레딧 차감. service role 전용. */
create or replace function public.spend_credits_for(p_user_id uuid, p_amount int, p_ref text, p_reason text default 'api')
returns int language plpgsql security definer set search_path = public as $$
declare v_bal int;
begin
  if p_amount <= 0 then raise exception 'BAD_AMOUNT'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select coalesce(sum(amount),0) into v_bal from public.credit_ledger where user_id = p_user_id;
  if v_bal < p_amount then raise exception 'INSUFFICIENT_CREDITS'; end if;
  insert into public.credit_ledger (user_id, amount, reason, ref_id) values (p_user_id, -p_amount, p_reason, p_ref);
  return v_bal - p_amount;
end $$;
revoke all on function public.spend_credits_for(uuid, int, text, text) from public, anon, authenticated;
grant execute on function public.spend_credits_for(uuid, int, text, text) to service_role;
