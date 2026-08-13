-- 블로그 자동 생성 + 훅 문구 영문 번역
-- 1) 자동 생성 글 구분: 'system'(업데이트 소식) | 'game'(게임 출시 소개) | null(수동)
alter table public.blog_posts add column if not exists source text;

-- 2) 게임 소개글 ↔ 게임 연결 (상세 페이지 우측에 게임 카드 노출)
alter table public.blog_posts add column if not exists game_id uuid references public.games(id) on delete set null;

-- 3) 카드 훅 문구 영문판 (EN 모드에서 표시)
alter table public.games add column if not exists teaser_en text;

-- 4) 게시 전 프로젝트에도 질문(훅 문구) 저장
alter table public.studio_projects add column if not exists teaser text;
