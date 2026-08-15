-- 아바타 프리뷰 버킷 — 이게 없어서 previewUrl 저장이 실패하고 있었다. 멱등.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');
drop policy if exists "avatars own write" on storage.objects;
create policy "avatars own write" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');
drop policy if exists "avatars own update" on storage.objects;
create policy "avatars own update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars');
