-- 게임 카드 앞면 '유혹 질문' — AI가 제목 기반으로 자동 생성해 저장
alter table public.games add column if not exists teaser text;
