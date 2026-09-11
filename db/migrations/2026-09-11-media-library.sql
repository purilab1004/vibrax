-- 미디어 라이브러리 — 장르별 캐릭터·배경·타일·아이템·UI·이펙트·스프라이트·오디오·3D 모델을 모아두고, 게임 생성 시 프롬프트/장르에 맞춰 자동 주입한다. 멱등.
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('character','background','tile','item','ui','effect','sprite','audio','model3d','font','other')),
  name text not null unique,                    -- 게임 코드에서 쓰는 키 (영문·숫자·_ , 예: hero_knight)
  title text not null,                          -- 표시 이름
  description text,
  genres text[] not null default '{}',          -- 템플릿 slug 또는 장르 그룹 (예: rpg-action, roguelike, runner)
  tags text[] not null default '{}',            -- 검색 태그 (예: 기사, 검, 픽셀, 어두운)
  path text not null,                           -- storage 경로 (media 버킷)
  url text not null,                            -- 공개 URL
  mime text,
  bytes int not null default 0,
  width int, height int,
  meta jsonb not null default '{}'::jsonb,      -- {frames:{cols,rows,fps}, anchor, palette, license, source}
  auto_use boolean not null default true,       -- 프롬프트/장르가 맞으면 자동 주입
  status text not null default 'active' check (status in ('active','archived')),
  uses int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_assets_kind_idx on public.media_assets (kind, status, created_at desc);
create index if not exists media_assets_genres_idx on public.media_assets using gin (genres);
create index if not exists media_assets_tags_idx on public.media_assets using gin (tags);
alter table public.media_assets enable row level security;
drop policy if exists media_assets_read on public.media_assets;
create policy media_assets_read on public.media_assets for select to authenticated using (status = 'active' or public.is_admin());
drop policy if exists media_assets_admin on public.media_assets;
create policy media_assets_admin on public.media_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 공개 버킷 (업로드는 서버 service role, 읽기는 공개)
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do update set public = true;
drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects for select to public using (bucket_id = 'media');

-- 사용 횟수 증가 RPC
create or replace function public.media_assets_touch(ids uuid[]) returns void language sql security definer as $$
  update public.media_assets set uses = uses + 1, updated_at = now() where id = any(ids);
$$;
