-- 관리자/블로그/공지/설정. 멱등 작성 — Supabase SQL Editor에서 여러 번 실행해도 안전.

-- 1) profiles: role + banned_at ---------------------------------------------
-- agent_name/country는 앱 코드가 기대하는 신규 컬럼인데 일부 환경에 없다
-- (admin_list_members가 참조하므로 여기서 보장)
alter table public.profiles add column if not exists agent_name text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists role text not null default 'user';
do $$ begin
  alter table public.profiles add constraint profiles_role_check check (role in ('user','admin'));
exception when duplicate_object then null; end $$;
alter table public.profiles add column if not exists banned_at timestamptz;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- 기본 관리자 시드
update public.profiles set role = 'admin'
where id in (select id from auth.users where email = 'puridev1155@gmail.com');

-- 2) blog_categories ---------------------------------------------------------
create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.blog_categories enable row level security;
drop policy if exists blog_categories_select on public.blog_categories;
create policy blog_categories_select on public.blog_categories for select using (true);
drop policy if exists blog_categories_insert on public.blog_categories;
create policy blog_categories_insert on public.blog_categories for insert with check (public.is_admin());
drop policy if exists blog_categories_update on public.blog_categories;
create policy blog_categories_update on public.blog_categories for update using (public.is_admin());
drop policy if exists blog_categories_delete on public.blog_categories;
create policy blog_categories_delete on public.blog_categories for delete using (public.is_admin());

-- 3) blog_posts ---------------------------------------------------------------
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.blog_categories(id) on delete set null,
  author_id uuid not null references public.profiles(id),
  title text not null default '',
  thumbnail_url text,
  content text not null default '',
  excerpt text not null default '',
  published boolean not null default false,
  published_at timestamptz,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blog_posts_published_idx on public.blog_posts (published, published_at desc);
alter table public.blog_posts enable row level security;
drop policy if exists blog_posts_select on public.blog_posts;
create policy blog_posts_select on public.blog_posts for select using (published or public.is_admin());
drop policy if exists blog_posts_insert on public.blog_posts;
create policy blog_posts_insert on public.blog_posts for insert with check (public.is_admin());
drop policy if exists blog_posts_update on public.blog_posts;
create policy blog_posts_update on public.blog_posts for update using (public.is_admin());
drop policy if exists blog_posts_delete on public.blog_posts;
create policy blog_posts_delete on public.blog_posts for delete using (public.is_admin());

create or replace function public.increment_blog_view(p_post_id uuid) returns void
language sql security definer set search_path = public as
$$ update public.blog_posts set view_count = view_count + 1 where id = p_post_id and published $$;
revoke all on function public.increment_blog_view(uuid) from public;
grant execute on function public.increment_blog_view(uuid) to authenticated, anon;

-- 4) notices ------------------------------------------------------------------
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content text not null default '',
  pinned boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notices enable row level security;
drop policy if exists notices_select on public.notices;
create policy notices_select on public.notices for select using (published or public.is_admin());
drop policy if exists notices_insert on public.notices;
create policy notices_insert on public.notices for insert with check (public.is_admin());
drop policy if exists notices_update on public.notices;
create policy notices_update on public.notices for update using (public.is_admin());
drop policy if exists notices_delete on public.notices;
create policy notices_delete on public.notices for delete using (public.is_admin());

-- 5) site_settings --------------------------------------------------------------
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists site_settings_select on public.site_settings;
create policy site_settings_select on public.site_settings for select using (true);
drop policy if exists site_settings_insert on public.site_settings;
create policy site_settings_insert on public.site_settings for insert with check (public.is_admin());
drop policy if exists site_settings_update on public.site_settings;
create policy site_settings_update on public.site_settings for update using (public.is_admin());

insert into public.site_settings (key, value) values
  ('signup_bonus', to_jsonb(30)),
  ('generation_cost', to_jsonb(10)),
  ('banner', jsonb_build_object('enabled', false, 'text', '', 'link', ''))
on conflict (key) do nothing;

-- 6) credit_ledger: admin_adjust 사유 추가 -------------------------------------
alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('purchase','generation','refund','signup_bonus','admin_adjust'));

-- 7) grant_signup_bonus: 지급액을 site_settings에서 읽도록 교체 -----------------
create or replace function public.grant_signup_bonus() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_bonus int;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select coalesce((value #>> '{}')::int, 30) into v_bonus
    from site_settings where key = 'signup_bonus';
  if v_bonus is null then v_bonus := 30; end if;
  insert into credit_ledger (user_id, amount, reason)
  values (v_user, v_bonus, 'signup_bonus')
  on conflict (user_id) where reason = 'signup_bonus' do nothing;
  return public.credit_balance();
end $$;
grant execute on function public.grant_signup_bonus() to authenticated;

-- 8) 밴 집행: restrictive 정책(기존 permissive 정책 이름을 몰라도 AND로 결합됨) ---
drop policy if exists games_block_banned on public.games;
create policy games_block_banned on public.games as restrictive
  for insert to authenticated
  with check ((select banned_at from public.profiles where id = auth.uid()) is null);
drop policy if exists studio_projects_block_banned on public.studio_projects;
create policy studio_projects_block_banned on public.studio_projects as restrictive
  for insert to authenticated
  with check ((select banned_at from public.profiles where id = auth.uid()) is null);

-- 9) 관리자 RPC ------------------------------------------------------------------
create or replace function public.admin_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'members', (select count(*) from profiles),
      'games', (select count(*) from games),
      'game_views', (select coalesce(sum(view_count), 0) from games),
      'generations', (select count(*) from credit_ledger where reason = 'generation'),
      'credits_purchased', (select coalesce(sum(amount), 0) from credit_ledger where reason = 'purchase'),
      'credits_spent', (select coalesce(-sum(amount), 0) from credit_ledger where reason = 'generation')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day, 'signups', coalesce(s.c, 0), 'games', coalesce(g.c, 0),
        'generations', coalesce(gen.c, 0), 'purchases', coalesce(p.c, 0)
      ) order by d.day), '[]'::jsonb)
      from (select generate_series(current_date - 29, current_date, interval '1 day')::date as day) d
      left join (select created_at::date as day, count(*) c from profiles
                 where created_at >= current_date - 29 group by 1) s using (day)
      left join (select created_at::date as day, count(*) c from games
                 where created_at >= current_date - 29 group by 1) g using (day)
      left join (select created_at::date as day, count(*) c from credit_ledger
                 where reason = 'generation' and created_at >= current_date - 29 group by 1) gen using (day)
      left join (select created_at::date as day, count(*) c from credit_ledger
                 where reason = 'purchase' and created_at >= current_date - 29 group by 1) p using (day)
    )
  ) into v;
  return v;
end $$;
revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.admin_dashboard_stats() to authenticated;

create or replace function public.admin_list_members(p_query text default null)
returns table (
  id uuid, email text, username text, agent_name text, role text,
  banned_at timestamptz, created_at timestamptz, balance bigint, games_count bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query
  select p.id, u.email::text, p.username, p.agent_name, p.role, p.banned_at, p.created_at,
    coalesce((select sum(cl.amount) from credit_ledger cl where cl.user_id = p.id), 0)::bigint,
    (select count(*) from games g where g.user_id = p.id)::bigint
  from profiles p
  join auth.users u on u.id = p.id
  where p_query is null or p_query = ''
     or u.email ilike '%' || p_query || '%' or p.username ilike '%' || p_query || '%'
  order by p.created_at desc
  limit 200;
end $$;
revoke all on function public.admin_list_members(text) from public;
grant execute on function public.admin_list_members(text) to authenticated;

create or replace function public.admin_set_role(p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_role not in ('user', 'admin') then raise exception 'INVALID_ROLE'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  update profiles set role = p_role where id = p_user_id;
end $$;
revoke all on function public.admin_set_role(uuid, text) from public;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

create or replace function public.admin_set_ban(p_user_id uuid, p_banned boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_BAN_SELF'; end if;
  if p_banned and exists (select 1 from profiles where id = p_user_id and role = 'admin') then
    raise exception 'CANNOT_BAN_ADMIN';
  end if;
  update profiles set banned_at = case when p_banned then now() else null end
  where id = p_user_id;
end $$;
revoke all on function public.admin_set_ban(uuid, boolean) from public;
grant execute on function public.admin_set_ban(uuid, boolean) to authenticated;

create or replace function public.admin_adjust_credits(p_user_id uuid, p_amount int, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_amount = 0 then raise exception 'ZERO_AMOUNT'; end if;
  insert into credit_ledger (user_id, amount, reason, ref_id)
  values (p_user_id, p_amount, 'admin_adjust', nullif(p_note, ''));
end $$;
revoke all on function public.admin_adjust_credits(uuid, int, text) from public;
grant execute on function public.admin_adjust_credits(uuid, int, text) to authenticated;

-- 10) blog-images 버킷 -------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;
drop policy if exists "blog images public read" on storage.objects;
create policy "blog images public read" on storage.objects
  for select using (bucket_id = 'blog-images');
drop policy if exists "blog images admin write" on storage.objects;
create policy "blog images admin write" on storage.objects
  for insert to authenticated with check (bucket_id = 'blog-images' and public.is_admin());

-- 11) games: 관리자 수정/삭제 허용 (permissive — 기존 소유자 정책과 OR 결합)
drop policy if exists games_admin_update on public.games;
create policy games_admin_update on public.games for update using (public.is_admin());
drop policy if exists games_admin_delete on public.games;
create policy games_admin_delete on public.games for delete using (public.is_admin());
