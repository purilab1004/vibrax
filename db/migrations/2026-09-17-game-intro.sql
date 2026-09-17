-- 게임 한 줄 소개 (쇼츠 카드 제작자 아래·게임 페이지에 표시). 등록/수정 시 직접 쓰거나 자동 생성(게임 매니페스트 goal)
alter table public.games add column if not exists intro text;
