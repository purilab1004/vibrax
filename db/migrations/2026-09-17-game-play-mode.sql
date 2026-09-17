-- 게임 플레이 방식: single(혼자) / multi(여럿·온라인). 등록·수정에서 고르고, 쇼츠 카드·게임 페이지에 아이콘 라벨로 표시
alter table public.games add column if not exists play_mode text not null default 'single';
alter table public.games drop constraint if exists games_play_mode_check;
alter table public.games add constraint games_play_mode_check check (play_mode in ('single', 'multi'));
