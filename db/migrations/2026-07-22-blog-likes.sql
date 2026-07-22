-- 블로그 좋아요 (게시글당 유저 1회). 멱등.
create table if not exists public.blog_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
alter table public.blog_post_likes enable row level security;
drop policy if exists blog_post_likes_select on public.blog_post_likes;
create policy blog_post_likes_select on public.blog_post_likes for select using (true);
drop policy if exists blog_post_likes_insert on public.blog_post_likes;
create policy blog_post_likes_insert on public.blog_post_likes
  for insert with check (user_id = auth.uid());
drop policy if exists blog_post_likes_delete on public.blog_post_likes;
create policy blog_post_likes_delete on public.blog_post_likes
  for delete using (user_id = auth.uid());
