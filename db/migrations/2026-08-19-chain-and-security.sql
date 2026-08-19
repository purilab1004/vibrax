-- 블록체인 준비(게임 코인 원장 해시체인 · 지갑) + 보안 이벤트 로그. 멱등.

-- 1) 게임 코인 원장 — profiles.vcoin 변동을 추가 전용(append-only) 해시 체인으로 기록 (변조 감지 → 추후 온체인 앵커링/토큰 스냅샷 근거)
create table if not exists public.game_coin_ledger (
  seq bigserial primary key,
  user_id uuid not null,
  delta int not null,
  balance_after int not null,
  reason text,                     -- 트리거는 'vcoin_update', 앱 RPC 는 spend/refund/ad_fund/… (추후 세분화)
  ref_id text,
  prev_hash text,
  hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists game_coin_ledger_user_idx on public.game_coin_ledger (user_id, seq desc);
alter table public.game_coin_ledger enable row level security;
drop policy if exists game_coin_ledger_own on public.game_coin_ledger;
create policy game_coin_ledger_own on public.game_coin_ledger for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- 수정/삭제 금지 (service role 은 RLS 우회하지만 앱에서 절대 사용하지 않음)
revoke update, delete on public.game_coin_ledger from authenticated, anon;

create or replace function public.game_coin_ledger_append() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prev text; v_hash text; v_delta int;
begin
  v_delta := coalesce(new.vcoin, 0) - coalesce(old.vcoin, 0);
  if v_delta = 0 then return new; end if;
  select hash into v_prev from game_coin_ledger order by seq desc limit 1;
  v_hash := encode(digest(coalesce(v_prev, 'genesis') || '|' || new.id::text || '|' || v_delta::text || '|' || new.vcoin::text || '|' || now()::text, 'sha256'), 'hex');
  insert into game_coin_ledger (user_id, delta, balance_after, reason, prev_hash, hash) values (new.id, v_delta, new.vcoin, 'vcoin_update', v_prev, v_hash);
  return new;
end $$;
create extension if not exists pgcrypto;
drop trigger if exists profiles_vcoin_ledger on public.profiles;
create trigger profiles_vcoin_ledger after update of vcoin on public.profiles for each row execute function public.game_coin_ledger_append();

-- 체인 무결성 검증: 깨진 첫 seq 를 반환 (없으면 null)
create or replace function public.game_coin_ledger_verify() returns bigint
language plpgsql security definer set search_path = public as $$
declare r record; v_prev text := null; v_bad bigint := null;
begin
  for r in select seq, prev_hash from game_coin_ledger order by seq loop
    if r.prev_hash is distinct from v_prev then v_bad := r.seq; exit; end if;
    select hash into v_prev from game_coin_ledger where seq = r.seq;
  end loop;
  return v_bad;
end $$;
revoke all on function public.game_coin_ledger_verify() from public;
grant execute on function public.game_coin_ledger_verify() to authenticated;

-- 2) 지갑 연결 (추후 온체인 출금/스냅샷용) — 서명 검증 전까지 verified=false
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  chain text not null default 'base',          -- base | polygon | ethereum
  address text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wallets enable row level security;
drop policy if exists wallets_own on public.wallets;
create policy wallets_own on public.wallets for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid());

-- 3) 보안 이벤트 로그 (서명 실패·차단·관리자 조치·이상 트래픽)
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,          -- webhook_bad_signature | webhook_bad_ip | admin_action | rate_limit | suspicious_traffic | auth
  severity text not null default 'warn',   -- info | warn | high
  ip_hash text,
  user_id uuid,
  path text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_events_created_idx on public.security_events (created_at desc);
alter table public.security_events enable row level security;
drop policy if exists security_events_admin on public.security_events;
create policy security_events_admin on public.security_events for select to authenticated using (public.is_admin());

-- 4) 접속 로그에 해시된 IP (원문 미저장) — 이상 트래픽 탐지용
alter table public.visits add column if not exists ip_hash text;
create index if not exists visits_ip_hash_idx on public.visits (ip_hash, created_at desc);

-- 5) Vibrex Chain v1 — 자체 체인의 블록: 원장 엔트리를 묶어 머클루트·이전 블록 해시로 봉인 (단일 노드 PoA, 다음 단계에서 다중 검증자로 확장)
create table if not exists public.chain_blocks (
  height bigserial primary key,
  prev_hash text,
  merkle_root text not null,
  from_seq bigint not null,
  to_seq bigint not null,
  tx_count int not null,
  block_hash text not null unique,
  sealed_at timestamptz not null default now()
);
alter table public.chain_blocks enable row level security;
drop policy if exists chain_blocks_read on public.chain_blocks;
create policy chain_blocks_read on public.chain_blocks for select using (true);   -- 블록 헤더는 공개(탐색기)
revoke update, delete on public.chain_blocks from authenticated, anon;

-- 아직 블록에 안 들어간 원장 엔트리를 하나의 블록으로 봉인 (service role/관리자 호출, cron 권장: 10분마다)
create or replace function public.chain_seal_block() returns bigint
language plpgsql security definer set search_path = public as $$
declare v_from bigint; v_to bigint; v_cnt int; v_root text := 'empty'; v_prev text; v_hash text; v_h bigint; r record;
begin
  select coalesce(max(to_seq), 0) + 1 into v_from from chain_blocks;
  select max(seq), count(*) into v_to, v_cnt from game_coin_ledger where seq >= v_from;
  if v_cnt is null or v_cnt = 0 then return null; end if;
  for r in select hash from game_coin_ledger where seq between v_from and v_to order by seq loop
    v_root := encode(digest(v_root || '|' || r.hash, 'sha256'), 'hex');   -- 순차 해시 (v1; 다음 단계에서 이진 머클트리)
  end loop;
  select block_hash into v_prev from chain_blocks order by height desc limit 1;
  v_hash := encode(digest(coalesce(v_prev, 'genesis') || '|' || v_root || '|' || v_from::text || '|' || v_to::text || '|' || now()::text, 'sha256'), 'hex');
  insert into chain_blocks (prev_hash, merkle_root, from_seq, to_seq, tx_count, block_hash) values (v_prev, v_root, v_from, v_to, v_cnt, v_hash) returning height into v_h;
  return v_h;
end $$;
revoke all on function public.chain_seal_block() from public, anon;
grant execute on function public.chain_seal_block() to authenticated;  -- API 는 관리자 확인 후 호출
