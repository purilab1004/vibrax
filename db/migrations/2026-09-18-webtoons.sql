-- 웹툰 쇼츠 — 컷 이미지를 탭으로 넘겨 보는 세로 쇼츠. games 피드에 게임·라이브·잭팟과 함께 섞여 나온다.
-- 이미지는 기존 thumbnails 버킷의 webtoons/<user_id>/... 경로에 올린다(버킷 정책 추가 불필요).

create table if not exists public.webtoons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,   -- games 와 같게 profiles 참조(제작자 정보 조인용)
  title text not null,
  intro text,                                  -- 한 줄 소개(쇼츠 카드 하단)
  cuts jsonb not null default '[]'::jsonb,     -- [{url, w, h}] — 보는 순서대로
  thumbnail_url text,                          -- 비우면 첫 컷을 쓴다
  game_id uuid references public.games(id) on delete set null,   -- 연결된 게임(선택)
  published boolean not null default true,
  view_count integer not null default 0,
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webtoons_created_idx on public.webtoons (created_at desc);
create index if not exists webtoons_user_idx on public.webtoons (user_id);
create index if not exists webtoons_game_idx on public.webtoons (game_id);

alter table public.webtoons enable row level security;

drop policy if exists "webtoons read published" on public.webtoons;
create policy "webtoons read published" on public.webtoons
  for select using (published or auth.uid() = user_id);

drop policy if exists "webtoons insert own" on public.webtoons;
create policy "webtoons insert own" on public.webtoons
  for insert with check (auth.uid() = user_id);

drop policy if exists "webtoons update own" on public.webtoons;
create policy "webtoons update own" on public.webtoons
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "webtoons delete own" on public.webtoons;
create policy "webtoons delete own" on public.webtoons
  for delete using (auth.uid() = user_id);

-- 조회수 — 로그인 없이도 올라가야 하므로 보안 정의자 함수로
create or replace function public.bump_webtoon_view(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.webtoons set view_count = view_count + 1 where id = p_id and published;
$$;

grant execute on function public.bump_webtoon_view(uuid) to anon, authenticated;
