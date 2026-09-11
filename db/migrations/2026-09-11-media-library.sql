create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('character','background','tile','item','ui','effect','sprite','audio','model3d','font','other')),
  name text not null unique,
  title text not null,
  description text,
  genres text[] not null default '{}',
  tags text[] not null default '{}',
  path text not null,
  url text not null,
  mime text,
  bytes int not null default 0,
  width int,
  height int,
  meta jsonb not null default '{}'::jsonb,
  auto_use boolean not null default true,
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
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do update set public = true;
drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects for select to public using (bucket_id = 'media');
create or replace function public.media_assets_touch(ids uuid[]) returns void language sql security definer as $$
  update public.media_assets set uses = uses + 1, updated_at = now() where id = any(ids);
$$;
