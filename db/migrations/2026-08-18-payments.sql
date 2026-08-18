-- 결제 관리 (Paddle) — 결제 내역 · 웹훅 이벤트 로그 · 환불 상태 · 크레딧 회수. 멱등.

-- 1) 결제 내역 (Paddle transaction 1건 = 1행)
create table if not exists public.payments (
  id text primary key,                          -- Paddle transaction id (txn_...)
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'completed',     -- completed | refund_pending | refunded | partially_refunded | chargeback | canceled | failed
  amount_minor bigint,                          -- 결제 총액 (통화 최소단위, 예: USD cents)
  currency text,
  credits int not null default 0,               -- 지급 크레딧
  price_id text,
  pack_key text,                                -- small | medium | large
  customer_email text,
  paddle_customer_id text,
  invoice_number text,
  payment_method text,                          -- card | paypal | ...
  card_brand text, card_last4 text,
  country text,
  refunded_minor bigint not null default 0,
  refund_reason text,
  refunded_at timestamptz,
  credits_revoked boolean not null default false,
  billed_at timestamptz,
  raw jsonb,                                    -- 마지막 transaction 페이로드
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
create index if not exists payments_created_idx on public.payments (created_at desc);
alter table public.payments enable row level security;
drop policy if exists "payments own read" on public.payments;
create policy "payments own read" on public.payments for select to authenticated using (auth.uid() = user_id or public.is_admin());

-- 2) 웹훅 이벤트 로그 (감사·디버깅용, 모든 이벤트 저장)
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,                         -- Paddle event id (evt_...)
  event_type text not null,
  transaction_id text,
  payload jsonb not null,
  processed boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists payment_events_tx_idx on public.payment_events (transaction_id, created_at desc);
alter table public.payment_events enable row level security;
drop policy if exists "payment events admin read" on public.payment_events;
create policy "payment events admin read" on public.payment_events for select to authenticated using (public.is_admin());

-- 3) 크레딧 원장 reason 확장: 환불 시 크레딧 회수(purchase_refund, 음수) · 차지백(chargeback)
alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('purchase','generation','refund','signup_bonus','admin_adjust','purchase_refund','chargeback'));
create unique index if not exists credit_ledger_purchase_refund_ref
  on public.credit_ledger (ref_id) where reason = 'purchase_refund';

-- 4) 기존 구매 백필: credit_ledger(purchase) → payments (금액 미상, 크레딧만)
insert into public.payments (id, user_id, status, credits, created_at, billed_at)
select cl.ref_id, cl.user_id, 'completed', cl.amount, cl.created_at, cl.created_at
from public.credit_ledger cl
where cl.reason = 'purchase' and cl.ref_id is not null
on conflict (id) do nothing;
