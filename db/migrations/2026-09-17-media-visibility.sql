alter table public.media_assets add column if not exists visibility text not null default 'public';
alter table public.media_assets drop constraint if exists media_assets_visibility_check;
alter table public.media_assets add constraint media_assets_visibility_check check (visibility in ('public','admin'));
