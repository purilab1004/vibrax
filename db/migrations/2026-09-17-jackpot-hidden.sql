-- 잭팟 숨기기 — 관리자가 숨긴 잭팟은 쇼츠 피드·REWARD 에 나오지 않는다 (기록·당첨자는 그대로)
alter table public.jackpots
  add column if not exists hidden boolean not null default false;
