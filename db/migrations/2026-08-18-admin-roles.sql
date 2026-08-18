-- 관리자 종류(role type) + 회원 삭제 + 슈퍼관리자 보호
-- Supabase SQL Editor 에서 실행

-- 1) 관리자 종류 -------------------------------------------------------------
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#2563eb',
  description text,
  permissions jsonb not null default '{}'::jsonb,   -- {"members":true,"games":true,...}
  is_system boolean not null default false,          -- 슈퍼관리자: 삭제/이름변경 불가
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_roles enable row level security;
drop policy if exists admin_roles_select on public.admin_roles;
create policy admin_roles_select on public.admin_roles for select using (public.is_admin());
drop policy if exists admin_roles_write on public.admin_roles;
create policy admin_roles_write on public.admin_roles for all using (public.is_admin()) with check (public.is_admin());

insert into public.admin_roles (name, color, description, permissions, is_system, sort_order)
values ('슈퍼관리자', '#e11d48', '모든 권한. 삭제할 수 없음.', '{"all":true}'::jsonb, true, 0)
on conflict (name) do nothing;
insert into public.admin_roles (name, color, description, permissions, sort_order)
values ('운영자', '#2563eb', '게임·회원·공지 관리', '{"games":true,"members":true,"notices":true,"blog":true}'::jsonb, 10)
on conflict (name) do nothing;

-- 2) profiles.admin_role_id -------------------------------------------------
alter table public.profiles add column if not exists admin_role_id uuid references public.admin_roles(id) on delete set null;
create index if not exists profiles_admin_role_idx on public.profiles(admin_role_id);

-- 기존 admin 에게 슈퍼관리자 배정
update public.profiles p set admin_role_id = (select id from public.admin_roles where is_system limit 1)
where p.role = 'admin' and p.admin_role_id is null;

-- 3) 슈퍼관리자 보호: puridev1155@gmail.com 은 항상 admin ---------------------
create or replace function public.super_admin_emails() returns text[]
language sql immutable as $$ select array['puridev1155@gmail.com']::text[] $$;

create or replace function public.protect_super_admin() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = new.id;
  if v_email = any (public.super_admin_emails()) then
    new.role := 'admin';
    new.banned_at := null;
    if new.admin_role_id is null then
      new.admin_role_id := (select id from public.admin_roles where is_system limit 1);
    end if;
  end if;
  -- 관리자 종류가 있으면 role 도 admin, 없으면 user 로 동기화
  if new.admin_role_id is not null then new.role := 'admin';
  elsif new.role = 'admin' and (tg_op = 'UPDATE' and old.admin_role_id is not null) then new.role := 'user';
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_super_admin on public.profiles;
create trigger profiles_protect_super_admin before insert or update on public.profiles
for each row execute function public.protect_super_admin();

-- 이미 존재하는 슈퍼관리자 계정 강제 승격
update public.profiles p set role = 'admin'
from auth.users u where u.id = p.id and u.email = any (public.super_admin_emails());

-- 4) admin_list_members: 관리자 종류 포함 -----------------------------------
drop function if exists public.admin_list_members(text);
create or replace function public.admin_list_members(p_query text default null)
returns table (
  id uuid, email text, username text, agent_name text, role text,
  banned_at timestamptz, created_at timestamptz, balance bigint, games_count bigint,
  admin_role_id uuid, admin_role_name text, admin_role_color text, last_sign_in_at timestamptz, avatar_url text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query
  select p.id, u.email::text, p.username, p.agent_name, p.role, p.banned_at, p.created_at,
    coalesce((select sum(cl.amount) from credit_ledger cl where cl.user_id = p.id), 0)::bigint,
    (select count(*) from games g where g.user_id = p.id)::bigint,
    p.admin_role_id, r.name, r.color, u.last_sign_in_at,
    (p.avatar_config->>'previewUrl')::text
  from profiles p
  join auth.users u on u.id = p.id
  left join admin_roles r on r.id = p.admin_role_id
  where p_query is null or p_query = ''
     or u.email ilike '%' || p_query || '%' or p.username ilike '%' || p_query || '%'
  order by p.created_at desc
  limit 300;
end $$;
revoke all on function public.admin_list_members(text) from public;
grant execute on function public.admin_list_members(text) to authenticated;

-- 5) 회원 완전 삭제 (service role 전용; 앱 API 에서 auth.users 삭제 전 호출) ---
create or replace function public.admin_purge_member(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text; t text;
begin
  select email into v_email from auth.users where id = p_user_id;
  if v_email = any (public.super_admin_emails()) then raise exception 'SUPER_ADMIN_PROTECTED'; end if;
  -- 사용자 소유 데이터 정리 (없는 테이블은 건너뜀)
  foreach t in array array[
    'delete from game_sessions where user_id = $1',
    'delete from game_coin_events where user_id = $1',
    'delete from aj_reports where game_id in (select id from games where user_id = $1)',
    'delete from game_shares where user_id = $1',
    'delete from game_likes where user_id = $1',
    'delete from game_views where user_id = $1',
    'delete from blog_post_likes where user_id = $1',
    'delete from llm_usage where user_id = $1',
    'delete from studio_messages where project_id in (select id from studio_projects where user_id = $1)',
    'delete from studio_versions where project_id in (select id from studio_projects where user_id = $1)',
    'delete from studio_projects where user_id = $1',
    'delete from tournament_applications where user_id = $1',
    'delete from partner_applications where user_id = $1',
    'delete from credit_ledger where user_id = $1',
    'delete from vcoin_ledger where user_id = $1',
    'delete from games where user_id = $1',
    'update blog_posts set author_id = (select p2.id from profiles p2 where p2.role = ''admin'' and p2.id <> $1 order by p2.created_at limit 1) where author_id = $1',
    'delete from profiles where id = $1'
  ] loop
    begin
      execute t using p_user_id;
    exception when undefined_table or undefined_column or not_null_violation then null;
    end;
  end loop;
end $$;
revoke all on function public.admin_purge_member(uuid) from public, authenticated, anon;
