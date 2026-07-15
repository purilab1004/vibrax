# Admin Panel + Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 전용 블로그(Tiptap WYSIWYG·카테고리·썸네일·이미지 업로드), 공지 게시판, 관리자 페이지(대시보드/게임/블로그/공지/회원/설정)를 추가한다.

**Architecture:** `profiles.role` + SECURITY DEFINER `is_admin()` + RLS가 모든 보호의 단일 근원. 관리자 화면은 `/admin/*` 서버 가드 레이아웃 아래 클라이언트 페이지. 집계는 `admin_dashboard_stats()` RPC 1회 호출, 차트는 의존성 없는 SVG.

**Tech Stack:** Next.js 16 App Router, Supabase (RLS/RPC), Tiptap v3, Tailwind 4, node:test

## Global Constraints

- 테마: 배경 `#0a0a0a`/`#111`, 포인트 `#00ff41`, `font-pixel`, 기존 페이지 스타일 답습
- i18n: 모든 사용자 노출 문자열은 `lib/i18n/translations.ts`에 ko/en 완전 패리티로 추가, `useLang()` 사용
- Supabase 클라이언트: 클라이언트 컴포넌트 `@/lib/supabase/client`, 서버 컴포넌트 `@/lib/supabase/server`
- 마이그레이션은 멱등: `if not exists`, `drop policy if exists`, `on conflict do nothing`, `do $$ ... exception when duplicate_object`
- 검증 게이트: `npm test`, `npx tsc --noEmit`, `npm run build` — 기존 lint 에러 5건(app/profile/page.tsx, components/NavBar.tsx) 외 신규 에러 0
- insert 시 타입 캐스팅은 기존 패턴(`as never`) 사용

---

### Task 1: 마이그레이션 + 타입 확장

**Files:**
- Create: `db/migrations/2026-07-15-admin-blog.sql`
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Produces: `is_admin()`, `admin_dashboard_stats()`, `admin_list_members(p_query)`, `admin_set_role(p_user_id,p_role)`, `admin_set_ban(p_user_id,p_banned)`, `admin_adjust_credits(p_user_id,p_amount,p_note)`, `increment_blog_view(p_post_id)` RPC들과 `blog_categories/blog_posts/notices/site_settings` 테이블, `blog-images` 버킷. TS 타입: `BlogCategory`, `BlogPost`, `Notice`, `AdminMember`, `DashboardStats`, `Profile.role/banned_at`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- db/migrations/2026-07-15-admin-blog.sql
-- 관리자/블로그/공지/설정. 멱등 작성 — Supabase SQL Editor에서 여러 번 실행해도 안전.

-- 1) profiles: role + banned_at ---------------------------------------------
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
```

- [ ] **Step 2: types.ts 확장**

`Profile`에 두 필드 추가:

```ts
export interface Profile {
  id: string
  username: string
  created_at: string
  avatar_config?: AvatarConfig | null
  agent_name?: string | null   // 공개 표시명(에이전트 이름) — 게임 카드/상세에 username 대신 노출
  role?: 'user' | 'admin'
  banned_at?: string | null
}
```

`CreditLedgerEntry.reason`에 `'admin_adjust'` 추가:

```ts
  reason: 'purchase' | 'generation' | 'refund' | 'signup_bonus' | 'admin_adjust'
```

새 인터페이스 (CreditLedgerEntry 아래에 추가):

```ts
export interface BlogCategory {
  id: string
  name: string
  slug: string
  sort_order: number
  created_at: string
}

export interface BlogPost {
  id: string
  category_id: string | null
  author_id: string
  title: string
  thumbnail_url: string | null
  content: string   // Tiptap HTML — admin만 쓸 수 있으므로 렌더 시 sanitize 없이 신뢰
  excerpt: string
  published: boolean
  published_at: string | null
  view_count: number
  created_at: string
  updated_at: string
}

export interface Notice {
  id: string
  title: string
  content: string
  pinned: boolean
  published: boolean
  created_at: string
  updated_at: string
}

export interface SiteSetting {
  key: string
  value: unknown
  updated_at: string
}

export interface BannerSetting {
  enabled: boolean
  text: string
  link: string
}

// admin_list_members() RPC 행
export interface AdminMember {
  id: string
  email: string
  username: string
  agent_name: string | null
  role: string
  banned_at: string | null
  created_at: string
  balance: number
  games_count: number
}

// admin_dashboard_stats() RPC 반환
export interface DashboardDaily {
  day: string
  signups: number
  games: number
  generations: number
  purchases: number
}
export interface DashboardStats {
  totals: {
    members: number
    games: number
    game_views: number
    generations: number
    credits_purchased: number
    credits_spent: number
  }
  daily: DashboardDaily[]
}
```

`Database.Tables`에 4개 테이블 추가 (credit_ledger 항목 뒤):

```ts
      blog_categories: {
        Row: BlogCategory
        Insert: Omit<BlogCategory, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<BlogCategory, 'id'>>
        Relationships: []
      }
      blog_posts: {
        Row: BlogPost
        Insert: Omit<BlogPost, 'id' | 'created_at' | 'updated_at' | 'view_count'> & {
          id?: string; created_at?: string; updated_at?: string; view_count?: number
        }
        Update: Partial<Omit<BlogPost, 'id'>>
        Relationships: []
      }
      notices: {
        Row: Notice
        Insert: Omit<Notice, 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Omit<Notice, 'id'>>
        Relationships: []
      }
      site_settings: {
        Row: SiteSetting
        Insert: SiteSetting & { updated_at?: string }
        Update: Partial<SiteSetting>
        Relationships: []
      }
```

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit` → 에러 0

- [ ] **Step 4: Commit**

```bash
git add db/migrations/2026-07-15-admin-blog.sql lib/supabase/types.ts
git commit -m "feat(admin): migration for roles, blog, notices, settings, admin RPCs"
```

> **라이브 적용**: 컨트롤러가 사용자에게 Supabase SQL Editor 실행을 안내하거나 psql로 적용. Task 2 이후 어느 시점이든 되지만 수동 테스트 전에는 필수.

---

### Task 2: 관리자 레이아웃/가드 + NavBar 링크

**Files:**
- Create: `app/admin/layout.tsx`, `components/admin/AdminNav.tsx`
- Modify: `components/NavBar.tsx`, `lib/i18n/translations.ts`

**Interfaces:**
- Consumes: `profiles.role` (Task 1)
- Produces: `/admin/*` 하위 페이지는 인증·권한 걱정 없이 렌더만 하면 됨. i18n `T.admin.nav*`, `T.nav.blog/notices/admin`

- [ ] **Step 1: i18n 키 추가** — translations.ts의 ko/en 양쪽에:

```ts
// nav 객체에
blog: '블로그',        // en: 'BLOG'
notices: '공지',       // en: 'NOTICES'
admin: '관리자',       // en: 'ADMIN'

// 최상위에 admin 섹션 (ko)
admin: {
  navDashboard: '대시보드',
  navGames: '게임 관리',
  navBlog: '블로그 관리',
  navNotices: '공지 관리',
  navMembers: '회원 관리',
  navSettings: '설정',
  loading: '불러오는 중...',
  saved: '저장되었습니다',
  saveFailed: '저장에 실패했습니다',
  delete: '삭제',
  deleteConfirm: '정말 삭제할까요? 되돌릴 수 없습니다.',
  save: '저장',
  cancel: '취소',
},
// en
admin: {
  navDashboard: 'DASHBOARD',
  navGames: 'GAMES',
  navBlog: 'BLOG',
  navNotices: 'NOTICES',
  navMembers: 'MEMBERS',
  navSettings: 'SETTINGS',
  loading: 'LOADING...',
  saved: 'Saved',
  saveFailed: 'Save failed',
  delete: 'Delete',
  deleteConfirm: 'Really delete? This cannot be undone.',
  save: 'Save',
  cancel: 'Cancel',
},
```

- [ ] **Step 2: app/admin/layout.tsx (서버 가드)**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if ((data as { role?: string } | null)?.role !== 'admin') redirect('/')
  return (
    <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row gap-8">
      <AdminNav />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: components/admin/AdminNav.tsx**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'

export default function AdminNav() {
  const pathname = usePathname()
  const { T } = useLang()
  const a = T.admin
  const items: [string, string][] = [
    ['/admin', a.navDashboard],
    ['/admin/games', a.navGames],
    ['/admin/blog', a.navBlog],
    ['/admin/notices', a.navNotices],
    ['/admin/members', a.navMembers],
    ['/admin/settings', a.navSettings],
  ]
  const active = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  return (
    <aside className="md:w-48 shrink-0">
      <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
        {items.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`font-pixel text-[10px] tracking-widest px-4 py-3 border transition-colors whitespace-nowrap ${
              active(href)
                ? 'border-[#00ff41] text-[#00ff41] bg-[#00ff41]/5'
                : 'border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 4: NavBar 수정** — user state 아래에 admin 여부 state 추가:

```tsx
const [isAdmin, setIsAdmin] = useState(false)

useEffect(() => {
  if (!user) { setIsAdmin(false); return }
  supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    .then(({ data }) => setIsAdmin((data as { role?: string } | null)?.role === 'admin'))
}, [user])
```

데스크톱 링크 블록(`{navLinkDesktop('/about', T.nav.about)}` 뒤가 아닌 games/studio 다음)에 `{navLinkDesktop('/blog', T.nav.blog)}` 추가, 로그인 블록 안 `{navLinkDesktop('/profile', T.nav.mypage)}` 뒤에 `{isAdmin && navLinkDesktop('/admin', T.nav.admin)}` 추가. 모바일 메뉴에도 동일하게 `navLinkMobile('/blog', T.nav.blog)`와 `{isAdmin && navLinkMobile('/admin', T.nav.admin)}` 추가. (공지 링크는 Task 6에서 블로그 페이지 탭으로 제공하므로 NavBar에는 블로그만.)

- [ ] **Step 5: 검증** — `npx tsc --noEmit` 에러 0, `npm run build` 성공

- [ ] **Step 6: Commit**

```bash
git add app/admin/layout.tsx components/admin/AdminNav.tsx components/NavBar.tsx lib/i18n/translations.ts
git commit -m "feat(admin): admin layout with server-side role guard and nav links"
```

---

### Task 3: 대시보드 (KPI + SVG 차트)

**Files:**
- Create: `lib/admin/chart.ts`, `lib/admin/chart.test.ts`, `components/admin/StatCard.tsx`, `components/admin/TrendChart.tsx`, `app/admin/page.tsx`
- Modify: `lib/i18n/translations.ts`

**Interfaces:**
- Consumes: `admin_dashboard_stats()` RPC → `DashboardStats` (Task 1)
- Produces: `linePoints(values: number[], width: number, height: number, pad?: number): string` (SVG polyline points), `<StatCard label value sub?>`, `<TrendChart label values labels color?>`

- [ ] **Step 1: 실패하는 테스트 작성** — `lib/admin/chart.test.ts`

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linePoints } from './chart'

test('linePoints: 빈 배열은 빈 문자열', () => {
  assert.equal(linePoints([], 100, 40), '')
})

test('linePoints: 점 개수는 값 개수와 같다', () => {
  const pts = linePoints([1, 2, 3], 100, 40)
  assert.equal(pts.split(' ').length, 3)
})

test('linePoints: 최댓값은 상단(pad), 0은 하단(height-pad)에 매핑', () => {
  const pts = linePoints([0, 10], 100, 40, 2).split(' ')
  assert.equal(pts[0].split(',')[1], '38') // 0 → height - pad
  assert.equal(pts[1].split(',')[1], '2')  // max → pad
})

test('linePoints: 전부 0이어도 NaN 없이 하단 라인', () => {
  const pts = linePoints([0, 0, 0], 100, 40, 2)
  assert.ok(!pts.includes('NaN'))
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` → Expected: FAIL (`Cannot find module './chart'`)

- [ ] **Step 3: 구현** — `lib/admin/chart.ts`

```ts
// SVG polyline points 생성 — 값들을 (width×height) 좌표계로 투영
export function linePoints(values: number[], width: number, height: number, pad = 2): string {
  if (values.length === 0) return ''
  const max = Math.max(...values, 1)
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
  return values
    .map((v, i) => {
      const x = pad + i * stepX
      const y = height - pad - (v / max) * (height - pad * 2)
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
    })
    .join(' ')
}
```

- [ ] **Step 4: 테스트 통과 확인** — Run: `npm test` → PASS

- [ ] **Step 5: i18n** — ko/en `admin` 섹션에 추가:

```ts
// ko
dashHeading: '대시보드',
statMembers: '전체 회원',
statGames: '게시된 게임',
statViews: '총 게임 조회수',
statGenerations: '게임 생성 횟수',
statPurchased: '판매된 크레딧',
statSpent: '소진된 크레딧',
chartSignups: '일별 가입',
chartGames: '일별 게임 게시',
chartGenerations: '일별 생성',
chartPurchases: '일별 구매 건수',
last30: '최근 30일',
loadFailed: '데이터를 불러오지 못했습니다',
// en
dashHeading: 'DASHBOARD',
statMembers: 'Members',
statGames: 'Published games',
statViews: 'Total game views',
statGenerations: 'Generations',
statPurchased: 'Credits sold',
statSpent: 'Credits spent',
chartSignups: 'Daily signups',
chartGames: 'Daily games published',
chartGenerations: 'Daily generations',
chartPurchases: 'Daily purchases',
last30: 'Last 30 days',
loadFailed: 'Failed to load data',
```

- [ ] **Step 6: 컴포넌트** — `components/admin/StatCard.tsx`

```tsx
export default function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-gray-800 bg-[#111] p-5">
      <p className="font-pixel text-[9px] text-gray-500 tracking-widest mb-2">{label}</p>
      <p className="text-2xl text-[#00ff41] font-pixel">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}
```

`components/admin/TrendChart.tsx`

```tsx
'use client'

import { linePoints } from '@/lib/admin/chart'

const W = 300
const H = 80

export default function TrendChart({ label, sub, values, color = '#00ff41' }: {
  label: string
  sub: string
  values: number[]
  color?: string
}) {
  const points = linePoints(values, W, H, 4)
  const total = values.reduce((a, b) => a + b, 0)
  return (
    <div className="border border-gray-800 bg-[#111] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-pixel text-[9px] text-gray-500 tracking-widest">{label}</p>
        <p className="font-pixel text-[9px] text-gray-600">{sub} · {total.toLocaleString()}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
        {points && (
          <>
            <polyline points={`4,${H - 4} ${points} ${W - 4},${H - 4}`} fill={color} opacity={0.08} stroke="none" />
            <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
          </>
        )}
      </svg>
    </div>
  )
}
```

- [ ] **Step 7: 대시보드 페이지** — `app/admin/page.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { DashboardStats } from '@/lib/supabase/types'
import StatCard from '@/components/admin/StatCard'
import TrendChart from '@/components/admin/TrendChart'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState(false)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  useEffect(() => {
    supabase.rpc('admin_dashboard_stats' as never).then(({ data, error }) => {
      if (error || !data) {
        console.error('[admin]', error)
        setError(true)
      } else {
        setStats(data as unknown as DashboardStats)
      }
    })
  }, [])

  if (error) return <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">{a.loadFailed}</p>
  if (!stats) return <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{a.loading}</p>

  const t = stats.totals
  const daily = stats.daily
  return (
    <div>
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-8">{a.dashHeading}</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label={a.statMembers} value={t.members} />
        <StatCard label={a.statGames} value={t.games} />
        <StatCard label={a.statViews} value={t.game_views} />
        <StatCard label={a.statGenerations} value={t.generations} />
        <StatCard label={a.statPurchased} value={t.credits_purchased} />
        <StatCard label={a.statSpent} value={t.credits_spent} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart label={a.chartSignups} sub={a.last30} values={daily.map(d => d.signups)} />
        <TrendChart label={a.chartGames} sub={a.last30} values={daily.map(d => d.games)} />
        <TrendChart label={a.chartGenerations} sub={a.last30} values={daily.map(d => d.generations)} color="#4da3ff" />
        <TrendChart label={a.chartPurchases} sub={a.last30} values={daily.map(d => d.purchases)} color="#ffd24d" />
      </div>
    </div>
  )
}
```

- [ ] **Step 8: 검증** — `npm test` 전체 PASS, `npx tsc --noEmit` 에러 0

- [ ] **Step 9: Commit**

```bash
git add lib/admin/ components/admin/StatCard.tsx components/admin/TrendChart.tsx app/admin/page.tsx lib/i18n/translations.ts
git commit -m "feat(admin): dashboard with KPI cards and dependency-free SVG trend charts"
```

---

### Task 4: RichTextEditor (Tiptap)

**Files:**
- Create: `components/admin/RichTextEditor.tsx`, `lib/blog/upload.ts`
- Modify: `package.json` (deps), `app/globals.css`

**Interfaces:**
- Produces: `<RichTextEditor value onChange onUploadImage />` — `onUploadImage: (file: File) => Promise<string | null>`; `uploadBlogImage(supabase: SupabaseClient, file: File): Promise<string | null>`; 본문 렌더용 CSS 클래스 `.rte-content`

- [ ] **Step 1: 의존성 설치**

Run: `npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/pm`
Expected: v3.x 설치. 만약 StarterKit v3에 Link가 포함되지 않은 v2가 설치되면 `@tiptap/extension-link`도 추가로 설치해 extensions 배열에 넣는다.

- [ ] **Step 2: 업로드 헬퍼** — `lib/blog/upload.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

// blog-images 공개 버킷에 업로드하고 public URL 반환. 실패 시 null.
export async function uploadBlogImage(supabase: SupabaseClient, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('blog-images').upload(path, file, { upsert: false })
  if (error) {
    console.error('[blog]', error)
    return null
  }
  return supabase.storage.from('blog-images').getPublicUrl(path).data.publicUrl
}
```

- [ ] **Step 3: 에디터 컴포넌트** — `components/admin/RichTextEditor.tsx`

```tsx
'use client'

import { useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'

export default function RichTextEditor({ value, onChange, onUploadImage }: {
  value: string
  onChange: (html: string) => void
  onUploadImage: (file: File) => Promise<string | null>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'rte-content min-h-[320px] px-4 py-3 outline-none' },
    },
  })
  if (!editor) return null

  const pickImage = () => fileRef.current?.click()
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await onUploadImage(file)
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().setLink({ href: url }).run()
  }

  const Btn = ({ onClick, active, children }: {
    onClick: () => void; active?: boolean; children: React.ReactNode
  }) => (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`px-2.5 py-1.5 text-xs border transition-colors ${
        active ? 'border-[#00ff41] text-[#00ff41]' : 'border-gray-800 text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
  const c = () => editor.chain().focus()

  return (
    <div className="border border-gray-700 bg-[#0d0d0d]">
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-800">
        <Btn onClick={() => c().toggleBold().run()} active={editor.isActive('bold')}><b>B</b></Btn>
        <Btn onClick={() => c().toggleItalic().run()} active={editor.isActive('italic')}><i>I</i></Btn>
        <Btn onClick={() => c().toggleStrike().run()} active={editor.isActive('strike')}><s>S</s></Btn>
        <Btn onClick={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>H2</Btn>
        <Btn onClick={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>H3</Btn>
        <Btn onClick={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')}>••</Btn>
        <Btn onClick={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')}>1.</Btn>
        <Btn onClick={() => c().toggleBlockquote().run()} active={editor.isActive('blockquote')}>&quot;</Btn>
        <Btn onClick={() => c().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}>{'</>'}</Btn>
        <Btn onClick={setLink} active={editor.isActive('link')}>🔗</Btn>
        <Btn onClick={pickImage}>🖼</Btn>
        <Btn onClick={() => c().setHorizontalRule().run()}>—</Btn>
        <Btn onClick={() => c().undo().run()}>↩</Btn>
        <Btn onClick={() => c().redo().run()}>↪</Btn>
      </div>
      <EditorContent editor={editor} />
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleFile} className="hidden" />
    </div>
  )
}
```

주의: Tiptap v3 StarterKit에는 Link가 포함된다. `setLink`가 타입 에러를 내면(v2가 설치된 경우) `@tiptap/extension-link`를 설치하고 `extensions: [StarterKit, Image, Link.configure({ openOnClick: false })]`로 변경.

- [ ] **Step 4: 본문 CSS** — `app/globals.css` 끝에 추가 (에디터와 공개 글 렌더 공용):

```css
/* Tiptap 에디터 + 블로그 본문 공용 타이포그래피 */
.rte-content { color: #d1d5db; font-size: 0.95rem; line-height: 1.8; }
.rte-content h2 { color: #fff; font-size: 1.35rem; font-weight: 700; margin: 1.6em 0 0.6em; }
.rte-content h3 { color: #fff; font-size: 1.1rem; font-weight: 700; margin: 1.4em 0 0.5em; }
.rte-content p { margin: 0.6em 0; }
.rte-content a { color: #00ff41; text-decoration: underline; }
.rte-content ul { list-style: disc; padding-left: 1.4em; margin: 0.6em 0; }
.rte-content ol { list-style: decimal; padding-left: 1.4em; margin: 0.6em 0; }
.rte-content blockquote { border-left: 3px solid #00ff41; padding-left: 1em; color: #9ca3af; margin: 1em 0; }
.rte-content pre { background: #111; border: 1px solid #1f2937; padding: 1em; overflow-x: auto; font-size: 0.85rem; margin: 1em 0; }
.rte-content code { background: #111; padding: 0.15em 0.35em; font-size: 0.85em; }
.rte-content pre code { background: none; padding: 0; }
.rte-content img { max-width: 100%; height: auto; margin: 1em 0; border: 1px solid #1f2937; }
.rte-content hr { border: none; border-top: 1px solid #1f2937; margin: 2em 0; }
```

- [ ] **Step 5: 검증** — `npx tsc --noEmit` 에러 0, `npm run build` 성공

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/admin/RichTextEditor.tsx lib/blog/upload.ts app/globals.css
git commit -m "feat(admin): Tiptap rich text editor with image upload"
```

---

### Task 5: 블로그 — 관리(목록/카테고리/에디터) + 공개 페이지

**Files:**
- Create: `lib/blog/excerpt.ts`, `lib/blog/excerpt.test.ts`, `components/admin/CategoryManager.tsx`, `components/admin/BlogPostForm.tsx`, `app/admin/blog/page.tsx`, `app/admin/blog/new/page.tsx`, `app/admin/blog/[id]/page.tsx`, `app/blog/page.tsx`, `app/blog/[id]/page.tsx`
- Modify: `lib/i18n/translations.ts`

**Interfaces:**
- Consumes: `RichTextEditor`, `uploadBlogImage` (Task 4); `blog_posts/blog_categories` 테이블, `increment_blog_view` RPC (Task 1)
- Produces: `stripHtml(html): string`, `makeExcerpt(html, max?): string`; `<BlogPostForm postId?>` (new/edit 공용)

- [ ] **Step 1: 실패하는 테스트** — `lib/blog/excerpt.test.ts`

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripHtml, makeExcerpt } from './excerpt'

test('stripHtml: 태그 제거 + 공백 정리', () => {
  assert.equal(stripHtml('<h2>제목</h2><p>본문 <b>강조</b></p>'), '제목 본문 강조')
})

test('stripHtml: 엔티티 디코드', () => {
  assert.equal(stripHtml('<p>A &amp; B &lt;C&gt;&nbsp;D</p>'), 'A & B <C> D')
})

test('makeExcerpt: 짧으면 그대로', () => {
  assert.equal(makeExcerpt('<p>짧은 글</p>'), '짧은 글')
})

test('makeExcerpt: 길면 max에서 자르고 말줄임', () => {
  const html = `<p>${'가'.repeat(300)}</p>`
  const out = makeExcerpt(html, 160)
  assert.equal(out.length, 161) // 160 + '…'
  assert.ok(out.endsWith('…'))
})
```

- [ ] **Step 2: 실패 확인** — `npm test` → FAIL (Cannot find module './excerpt')

- [ ] **Step 3: 구현** — `lib/blog/excerpt.ts`

```ts
// Tiptap HTML에서 목록 카드용 발췌문 생성
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function makeExcerpt(html: string, max = 160): string {
  const text = stripHtml(html)
  return text.length <= max ? text : text.slice(0, max).trimEnd() + '…'
}
```

- [ ] **Step 4: 통과 확인** — `npm test` → PASS

- [ ] **Step 5: i18n** — ko/en에 `blog` 섹션 신설 + `admin` 섹션 확장:

```ts
// ko blog
blog: {
  heading: '블로그',
  all: '전체',
  empty: '아직 글이 없습니다.',
  views: (n: number) => `조회 ${n}`,
  back: '목록으로',
  notFound: '글을 찾을 수 없습니다.',
},
// en blog
blog: {
  heading: 'BLOG',
  all: 'ALL',
  empty: 'No posts yet.',
  views: (n: number) => `${n} views`,
  back: 'BACK TO LIST',
  notFound: 'Post not found.',
},
// ko admin 섹션에 추가
blogHeading: '블로그 관리',
newPost: '새 글 쓰기',
postTitle: '제목',
postCategory: '카테고리',
noCategory: '카테고리 없음',
postThumb: '썸네일',
postContent: '본문',
published: '발행됨',
draft: '임시저장',
publishToggle: '발행하기',
unpublishToggle: '발행 취소',
categories: '카테고리',
addCategory: '추가',
categoryName: '카테고리 이름',
noPosts: '글이 없습니다. 첫 글을 작성해보세요.',
edit: '수정',
// en admin 섹션에 추가
blogHeading: 'BLOG ADMIN',
newPost: 'NEW POST',
postTitle: 'Title',
postCategory: 'Category',
noCategory: 'No category',
postThumb: 'Thumbnail',
postContent: 'Content',
published: 'Published',
draft: 'Draft',
publishToggle: 'Publish',
unpublishToggle: 'Unpublish',
categories: 'Categories',
addCategory: 'ADD',
categoryName: 'Category name',
noPosts: 'No posts yet. Write your first one.',
edit: 'Edit',
```

- [ ] **Step 6: 카테고리 관리** — `components/admin/CategoryManager.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory } from '@/lib/supabase/types'

// name → slug: 한글 유지, 공백/특수문자를 하이픈으로
export function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'category'
}

export default function CategoryManager({ onChanged }: { onChanged?: () => void }) {
  const [cats, setCats] = useState<BlogCategory[]>([])
  const [name, setName] = useState('')
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = () =>
    supabase.from('blog_categories').select('*').order('sort_order').order('created_at')
      .then(({ data }) => setCats((data as BlogCategory[] | null) ?? []))

  useEffect(() => { load() }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const { error } = await supabase.from('blog_categories')
      .insert([{ name: name.trim(), slug: slugify(name), sort_order: cats.length }] as never)
    if (error) console.error('[admin]', error)
    setName('')
    await load()
    onChanged?.()
  }

  const remove = async (id: string) => {
    if (!confirm(a.deleteConfirm)) return
    const { error } = await supabase.from('blog_categories').delete().eq('id', id)
    if (error) console.error('[admin]', error)
    await load()
    onChanged?.()
  }

  return (
    <div className="border border-gray-800 bg-[#111] p-5">
      <h2 className="font-pixel text-[10px] text-gray-400 tracking-widest mb-4">{a.categories}</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {cats.map(c => (
          <span key={c.id} className="flex items-center gap-2 border border-gray-700 px-3 py-1.5 text-xs text-gray-300">
            {c.name}
            <button onClick={() => remove(c.id)} className="text-gray-600 hover:text-red-400">✕</button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={a.categoryName}
          className="flex-1 bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-3 py-2 text-xs outline-none text-white placeholder-gray-600"
        />
        <button type="submit" className="font-pixel text-[10px] bg-[#00ff41] text-black px-4 hover:bg-[#00cc33] transition-colors">
          {a.addCategory}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: 글 폼 (new/edit 공용)** — `components/admin/BlogPostForm.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'
import RichTextEditor from '@/components/admin/RichTextEditor'
import { uploadBlogImage } from '@/lib/blog/upload'
import { makeExcerpt } from '@/lib/blog/excerpt'

export default function BlogPostForm({ postId }: { postId?: string }) {
  const [loaded, setLoaded] = useState(!postId)
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [published, setPublished] = useState(false)
  const [cats, setCats] = useState<BlogCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<'saved' | 'failed' | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  useEffect(() => {
    supabase.from('blog_categories').select('*').order('sort_order')
      .then(({ data }) => setCats((data as BlogCategory[] | null) ?? []))
    if (postId) {
      supabase.from('blog_posts').select('*').eq('id', postId).maybeSingle().then(({ data }) => {
        const p = data as BlogPost | null
        if (p) {
          setTitle(p.title)
          setCategoryId(p.category_id ?? '')
          setThumbnailUrl(p.thumbnail_url)
          setContent(p.content)
          setPublished(p.published)
        }
        setLoaded(true)
      })
    }
  }, [postId])

  const uploadThumb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await uploadBlogImage(supabase, file)
    if (url) setThumbnailUrl(url)
  }

  const save = async (nextPublished: boolean) => {
    if (saving) return
    setSaving(true)
    setMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const row = {
        title: title.trim() || a.postTitle,
        category_id: categoryId || null,
        thumbnail_url: thumbnailUrl,
        content,
        excerpt: makeExcerpt(content),
        published: nextPublished,
        published_at: nextPublished ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }
      if (postId) {
        const { error } = await supabase.from('blog_posts').update(row as never).eq('id', postId)
        if (error) throw error
        setPublished(nextPublished)
        setMsg('saved')
      } else {
        const { data, error } = await supabase.from('blog_posts')
          .insert([{ ...row, author_id: user.id }] as never).select().single()
        if (error) throw error
        router.replace(`/admin/blog/${(data as BlogPost).id}`)
      }
    } catch (err) {
      console.error('[admin]', err)
      setMsg('failed')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{a.loading}</p>

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-500'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className={`font-pixel text-[9px] tracking-widest px-2 py-1 border ${
          published ? 'border-[#00ff41] text-[#00ff41]' : 'border-gray-700 text-gray-500'
        }`}>
          {published ? a.published : a.draft}
        </span>
        {msg === 'saved' && <span className="text-[#00ff41] text-xs">{a.saved}</span>}
        {msg === 'failed' && <span className="text-red-400 text-xs">{a.saveFailed}</span>}
      </div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder={a.postTitle} className={inputClass} />
      <div className="flex gap-3 flex-wrap">
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={`${inputClass} max-w-xs`}>
          <option value="">{a.noCategory}</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-3 cursor-pointer border border-gray-700 px-4 text-xs text-gray-400 hover:border-gray-500">
          {a.postThumb}
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={uploadThumb} className="hidden" />
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="" className="h-10 w-16 object-cover border border-gray-800" />
          )}
        </label>
      </div>
      <RichTextEditor value={content} onChange={setContent} onUploadImage={f => uploadBlogImage(supabase, f)} />
      <div className="flex gap-3">
        <button
          onClick={() => save(published)}
          disabled={saving}
          className="font-pixel text-[10px] tracking-widest border border-gray-600 text-gray-300 px-6 py-3 hover:border-[#00ff41] hover:text-[#00ff41] transition-colors disabled:opacity-50"
        >
          {a.save}
        </button>
        <button
          onClick={() => save(!published)}
          disabled={saving}
          className="font-pixel text-[10px] tracking-widest bg-[#00ff41] text-black px-6 py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50"
        >
          {published ? a.unpublishToggle : a.publishToggle}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: 관리 페이지 3개**

`app/admin/blog/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'
import CategoryManager from '@/components/admin/CategoryManager'

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [cats, setCats] = useState<BlogCategory[]>([])
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = () => {
    supabase.from('blog_posts')
      .select('id,title,category_id,published,view_count,created_at,updated_at,author_id,thumbnail_url,excerpt,published_at,content')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPosts((data as BlogPost[] | null) ?? []))
    supabase.from('blog_categories').select('*')
      .then(({ data }) => setCats((data as BlogCategory[] | null) ?? []))
  }
  useEffect(() => { load() }, [])

  const remove = async (id: string) => {
    if (!confirm(a.deleteConfirm)) return
    await supabase.from('blog_posts').delete().eq('id', id)
    load()
  }

  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? '—'

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest">{a.blogHeading}</h1>
        <Link href="/admin/blog/new" className="font-pixel text-[10px] bg-[#00ff41] text-black px-4 py-2.5 hover:bg-[#00cc33] transition-colors tracking-widest">
          {a.newPost}
        </Link>
      </div>
      <div className="mb-8"><CategoryManager onChanged={load} /></div>
      {posts.length === 0 ? (
        <p className="text-gray-500 text-sm">{a.noPosts}</p>
      ) : (
        <div className="border border-gray-800 divide-y divide-gray-800">
          {posts.map(p => (
            <div key={p.id} className="flex items-center gap-4 px-4 py-3 bg-[#111]">
              <span className={`font-pixel text-[8px] tracking-widest px-1.5 py-0.5 border shrink-0 ${
                p.published ? 'border-[#00ff41] text-[#00ff41]' : 'border-gray-700 text-gray-500'
              }`}>
                {p.published ? a.published : a.draft}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm truncate">{p.title || '—'}</p>
                <p className="text-[10px] text-gray-600">
                  {catName(p.category_id)} · {new Date(p.created_at).toLocaleDateString()} · 👁 {p.view_count}
                </p>
              </div>
              <Link href={`/admin/blog/${p.id}`} className="font-pixel text-[9px] text-gray-400 hover:text-[#00ff41] tracking-widest shrink-0">
                {a.edit}
              </Link>
              <button onClick={() => remove(p.id)} className="font-pixel text-[9px] text-gray-600 hover:text-red-400 tracking-widest shrink-0">
                {a.delete}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

`app/admin/blog/new/page.tsx`:

```tsx
import BlogPostForm from '@/components/admin/BlogPostForm'

export default function NewBlogPostPage() {
  return <BlogPostForm />
}
```

`app/admin/blog/[id]/page.tsx`:

```tsx
import BlogPostForm from '@/components/admin/BlogPostForm'

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <BlogPostForm postId={id} />
}
```

- [ ] **Step 9: 공개 블로그**

`app/blog/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null)
  const [cats, setCats] = useState<BlogCategory[]>([])
  const [activeCat, setActiveCat] = useState<string>('')
  const supabase = createClient()
  const { T } = useLang()
  const b = T.blog

  useEffect(() => {
    supabase.from('blog_categories').select('*').order('sort_order')
      .then(({ data }) => setCats((data as BlogCategory[] | null) ?? []))
  }, [])

  useEffect(() => {
    let q = supabase.from('blog_posts')
      .select('id,title,thumbnail_url,excerpt,category_id,published_at,view_count,created_at,author_id,content,published,updated_at')
      .eq('published', true)
      .order('published_at', { ascending: false })
    if (activeCat) q = q.eq('category_id', activeCat)
    q.then(({ data }) => setPosts((data as BlogPost[] | null) ?? []))
  }, [activeCat])

  const catBtn = (id: string, label: string) => (
    <button
      key={id || 'all'}
      onClick={() => setActiveCat(id)}
      className={`font-pixel text-[10px] tracking-widest px-4 py-2 border transition-colors ${
        activeCat === id ? 'border-[#00ff41] text-[#00ff41]' : 'border-gray-800 text-gray-500 hover:text-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-8">{b.heading}</h1>
      <div className="flex gap-2 flex-wrap mb-8">
        {catBtn('', b.all)}
        {cats.map(c => catBtn(c.id, c.name))}
      </div>
      {posts === null ? null : posts.length === 0 ? (
        <p className="text-gray-500 text-sm">{b.empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map(p => (
            <Link key={p.id} href={`/blog/${p.id}`} className="border border-gray-800 bg-[#111] hover:border-[#00ff41] transition-colors group">
              {p.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnail_url} alt={p.title} className="w-full aspect-video object-cover border-b border-gray-800" />
              ) : (
                <div className="w-full aspect-video border-b border-gray-800 flex items-center justify-center">
                  <span className="font-pixel text-[#00ff41]/30 text-xs">VIBRAX</span>
                </div>
              )}
              <div className="p-4">
                <h2 className="text-white text-sm mb-2 line-clamp-2 group-hover:text-[#00ff41] transition-colors">{p.title}</h2>
                <p className="text-gray-500 text-xs line-clamp-2 mb-3">{p.excerpt}</p>
                <p className="text-[10px] text-gray-600">
                  {p.published_at ? new Date(p.published_at).toLocaleDateString() : ''} · {b.views(p.view_count)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

`app/blog/[id]/page.tsx`:

```tsx
'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'

export default function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [post, setPost] = useState<BlogPost | null | undefined>(undefined)
  const [cat, setCat] = useState<BlogCategory | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const b = T.blog

  useEffect(() => {
    supabase.from('blog_posts').select('*').eq('id', id).eq('published', true).maybeSingle()
      .then(async ({ data }) => {
        const p = data as BlogPost | null
        setPost(p)
        if (p) {
          supabase.rpc('increment_blog_view' as never, { p_post_id: p.id } as never).then(() => {})
          if (p.category_id) {
            const { data: c } = await supabase.from('blog_categories').select('*').eq('id', p.category_id).maybeSingle()
            setCat(c as BlogCategory | null)
          }
        }
      })
  }, [id])

  if (post === undefined) return null
  if (post === null) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-400 text-sm mb-6">{b.notFound}</p>
        <Link href="/blog" className="font-pixel text-[10px] text-[#00ff41] tracking-widest">{b.back}</Link>
      </div>
    )
  }

  return (
    <article className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/blog" className="font-pixel text-[9px] text-gray-500 hover:text-[#00ff41] tracking-widest">← {b.back}</Link>
      <h1 className="text-white text-2xl md:text-3xl font-bold mt-6 mb-3">{post.title}</h1>
      <p className="text-[11px] text-gray-500 mb-8">
        {cat && <span className="text-[#00ff41] mr-3">{cat.name}</span>}
        {post.published_at ? new Date(post.published_at).toLocaleDateString() : ''} · {b.views(post.view_count)}
      </p>
      {post.thumbnail_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumbnail_url} alt={post.title} className="w-full mb-8 border border-gray-800" />
      )}
      {/* content는 RLS로 admin만 작성 가능 — 신뢰 경계 내 HTML */}
      <div className="rte-content" dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  )
}
```

- [ ] **Step 10: 검증** — `npm test` PASS, `npx tsc --noEmit` 에러 0, `npm run build` 성공

- [ ] **Step 11: Commit**

```bash
git add lib/blog/ components/admin/CategoryManager.tsx components/admin/BlogPostForm.tsx app/admin/blog/ app/blog/ lib/i18n/translations.ts
git commit -m "feat(blog): admin blog management and public blog pages"
```

---

### Task 6: 공지 — 관리 + 공개 + 홈 배너

**Files:**
- Create: `app/admin/notices/page.tsx`, `app/notices/page.tsx`, `app/notices/[id]/page.tsx`, `components/HomeBanner.tsx`
- Modify: `lib/i18n/translations.ts`, `app/page.tsx`, `app/blog/page.tsx`(공지 링크 탭)

**Interfaces:**
- Consumes: `notices` 테이블, `site_settings.banner`(Task 1), `RichTextEditor`(Task 4)
- Produces: `<HomeBanner />` — 배너 설정 enabled면 홈 최상단 한 줄 배너

- [ ] **Step 1: i18n** — ko/en에 `notices` 섹션 신설 + `admin` 확장:

```ts
// ko notices
notices: {
  heading: '공지사항',
  empty: '등록된 공지가 없습니다.',
  pinned: '고정',
  back: '목록으로',
  notFound: '공지를 찾을 수 없습니다.',
},
// en notices
notices: {
  heading: 'NOTICES',
  empty: 'No notices yet.',
  pinned: 'PINNED',
  back: 'BACK TO LIST',
  notFound: 'Notice not found.',
},
// ko admin 추가
noticesHeading: '공지 관리',
newNotice: '새 공지',
noticeTitle: '제목',
pinnedLabel: '상단 고정',
publishedLabel: '공개',
// en admin 추가
noticesHeading: 'NOTICES ADMIN',
newNotice: 'NEW NOTICE',
noticeTitle: 'Title',
pinnedLabel: 'Pin to top',
publishedLabel: 'Public',
```

- [ ] **Step 2: 관리 페이지** — `app/admin/notices/page.tsx` (목록 + 인라인 편집 폼 단일 페이지)

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Notice } from '@/lib/supabase/types'
import RichTextEditor from '@/components/admin/RichTextEditor'
import { uploadBlogImage } from '@/lib/blog/upload'

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [editing, setEditing] = useState<Notice | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [published, setPublished] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = () =>
    supabase.from('notices').select('*')
      .order('pinned', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => setNotices((data as Notice[] | null) ?? []))
  useEffect(() => { load() }, [])

  const open = (n: Notice | 'new') => {
    setEditing(n)
    setTitle(n === 'new' ? '' : n.title)
    setContent(n === 'new' ? '' : n.content)
    setPinned(n === 'new' ? false : n.pinned)
    setPublished(n === 'new' ? true : n.published)
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const row = { title: title.trim(), content, pinned, published, updated_at: new Date().toISOString() }
      const { error } = editing === 'new'
        ? await supabase.from('notices').insert([row] as never)
        : await supabase.from('notices').update(row as never).eq('id', (editing as Notice).id)
      if (error) console.error('[admin]', error)
      else setEditing(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm(a.deleteConfirm)) return
    await supabase.from('notices').delete().eq('id', id)
    await load()
  }

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-500'

  if (editing !== null) {
    return (
      <div className="space-y-5">
        <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest">{editing === 'new' ? a.newNotice : a.edit}</h1>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={a.noticeTitle} className={inputClass} />
        <RichTextEditor value={content} onChange={setContent} onUploadImage={f => uploadBlogImage(supabase, f)} />
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="accent-[#00ff41]" />
            {a.pinnedLabel}
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="accent-[#00ff41]" />
            {a.publishedLabel}
          </label>
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="font-pixel text-[10px] tracking-widest bg-[#00ff41] text-black px-6 py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50">
            {a.save}
          </button>
          <button onClick={() => setEditing(null)} className="font-pixel text-[10px] tracking-widest border border-gray-700 text-gray-400 px-6 py-3 hover:border-gray-500 transition-colors">
            {a.cancel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest">{a.noticesHeading}</h1>
        <button onClick={() => open('new')} className="font-pixel text-[10px] bg-[#00ff41] text-black px-4 py-2.5 hover:bg-[#00cc33] transition-colors tracking-widest">
          {a.newNotice}
        </button>
      </div>
      <div className="border border-gray-800 divide-y divide-gray-800">
        {notices.map(n => (
          <div key={n.id} className="flex items-center gap-4 px-4 py-3 bg-[#111]">
            {n.pinned && <span className="font-pixel text-[8px] text-[#00ff41] border border-[#00ff41] px-1.5 py-0.5 shrink-0">📌</span>}
            <div className="min-w-0 flex-1">
              <p className={`text-sm truncate ${n.published ? 'text-white' : 'text-gray-600'}`}>{n.title || '—'}</p>
              <p className="text-[10px] text-gray-600">{new Date(n.created_at).toLocaleDateString()}</p>
            </div>
            <button onClick={() => open(n)} className="font-pixel text-[9px] text-gray-400 hover:text-[#00ff41] tracking-widest shrink-0">{a.edit}</button>
            <button onClick={() => remove(n.id)} className="font-pixel text-[9px] text-gray-600 hover:text-red-400 tracking-widest shrink-0">{a.delete}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 공개 공지** — `app/notices/page.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Notice } from '@/lib/supabase/types'

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const n = T.notices

  useEffect(() => {
    supabase.from('notices').select('id,title,pinned,created_at,content,published,updated_at')
      .eq('published', true)
      .order('pinned', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => setNotices((data as Notice[] | null) ?? []))
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-8">{n.heading}</h1>
      {notices === null ? null : notices.length === 0 ? (
        <p className="text-gray-500 text-sm">{n.empty}</p>
      ) : (
        <div className="border border-gray-800 divide-y divide-gray-800">
          {notices.map(item => (
            <Link key={item.id} href={`/notices/${item.id}`} className="flex items-center gap-3 px-5 py-4 bg-[#111] hover:bg-[#161616] transition-colors group">
              {item.pinned && (
                <span className="font-pixel text-[8px] text-[#00ff41] border border-[#00ff41] px-1.5 py-0.5 shrink-0">{n.pinned}</span>
              )}
              <span className="text-sm text-white group-hover:text-[#00ff41] transition-colors truncate flex-1">{item.title}</span>
              <span className="text-[10px] text-gray-600 shrink-0">{new Date(item.created_at).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

`app/notices/[id]/page.tsx`:

```tsx
'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Notice } from '@/lib/supabase/types'

export default function NoticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [notice, setNotice] = useState<Notice | null | undefined>(undefined)
  const supabase = createClient()
  const { T } = useLang()
  const n = T.notices

  useEffect(() => {
    supabase.from('notices').select('*').eq('id', id).eq('published', true).maybeSingle()
      .then(({ data }) => setNotice(data as Notice | null))
  }, [id])

  if (notice === undefined) return null
  if (notice === null) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-400 text-sm mb-6">{n.notFound}</p>
        <Link href="/notices" className="font-pixel text-[10px] text-[#00ff41] tracking-widest">{n.back}</Link>
      </div>
    )
  }

  return (
    <article className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/notices" className="font-pixel text-[9px] text-gray-500 hover:text-[#00ff41] tracking-widest">← {n.back}</Link>
      <h1 className="text-white text-2xl font-bold mt-6 mb-3">{notice.title}</h1>
      <p className="text-[11px] text-gray-500 mb-8">{new Date(notice.created_at).toLocaleDateString()}</p>
      <div className="rte-content" dangerouslySetInnerHTML={{ __html: notice.content }} />
    </article>
  )
}
```

- [ ] **Step 4: 홈 배너** — `components/HomeBanner.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { BannerSetting } from '@/lib/supabase/types'

export default function HomeBanner() {
  const [banner, setBanner] = useState<BannerSetting | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'banner').maybeSingle()
      .then(({ data }) => {
        const v = (data as { value?: BannerSetting } | null)?.value
        if (v?.enabled && v.text) setBanner(v)
      })
  }, [])

  if (!banner) return null
  const inner = (
    <p className="max-w-7xl mx-auto px-6 py-2.5 text-center text-xs text-black font-pixel tracking-widest truncate">
      📢 {banner.text}
    </p>
  )
  return banner.link
    ? <Link href={banner.link} className="block bg-[#00ff41] hover:bg-[#00cc33] transition-colors">{inner}</Link>
    : <div className="bg-[#00ff41]">{inner}</div>
}
```

`app/page.tsx` 수정: `import HomeBanner from '@/components/HomeBanner'` 추가, 최상위 JSX에서 `<HeroSection />` 바로 위에 `<HomeBanner />` 배치.

`app/blog/page.tsx` 수정: 카테고리 필터 행 오른쪽 끝에 공지 링크 추가 — 필터 div를 `flex justify-between` 래퍼로 감싸고:

```tsx
<Link href="/notices" className="font-pixel text-[10px] tracking-widest px-4 py-2 border border-gray-800 text-gray-500 hover:text-[#00ff41] hover:border-[#00ff41] transition-colors">
  {T.notices.heading} →
</Link>
```

- [ ] **Step 5: 검증** — `npx tsc --noEmit` 에러 0, `npm run build` 성공

- [ ] **Step 6: Commit**

```bash
git add app/admin/notices/ app/notices/ components/HomeBanner.tsx app/page.tsx app/blog/page.tsx lib/i18n/translations.ts
git commit -m "feat(notices): admin notice management, public notice board, home banner"
```

---

### Task 7: 회원 관리

**Files:**
- Create: `app/admin/members/page.tsx`
- Modify: `lib/i18n/translations.ts`

**Interfaces:**
- Consumes: `admin_list_members`, `admin_set_role`, `admin_set_ban`, `admin_adjust_credits` RPC → `AdminMember` (Task 1)

- [ ] **Step 1: i18n** — ko/en `admin` 섹션에 추가:

```ts
// ko
membersHeading: '회원 관리',
searchMembers: '이메일/이름 검색',
colMember: '회원',
colJoined: '가입일',
colBalance: '잔액',
colGames: '게임',
colRole: '등급',
roleAdmin: '관리자',
roleUser: '일반',
promote: '관리자로',
demote: '해제',
ban: '정지',
unban: '정지 해제',
bannedTag: '정지됨',
adjustCredits: '크레딧 조정',
adjustAmount: '금액 (음수는 차감)',
adjustNote: '메모 (선택)',
apply: '적용',
actionFailed: '작업에 실패했습니다',
// en
membersHeading: 'MEMBERS',
searchMembers: 'Search email/username',
colMember: 'Member',
colJoined: 'Joined',
colBalance: 'Balance',
colGames: 'Games',
colRole: 'Role',
roleAdmin: 'ADMIN',
roleUser: 'USER',
promote: 'Make admin',
demote: 'Demote',
ban: 'Ban',
unban: 'Unban',
bannedTag: 'BANNED',
adjustCredits: 'Adjust credits',
adjustAmount: 'Amount (negative = deduct)',
adjustNote: 'Note (optional)',
apply: 'APPLY',
actionFailed: 'Action failed',
```

- [ ] **Step 2: 페이지** — `app/admin/members/page.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { AdminMember } from '@/lib/supabase/types'

export default function AdminMembersPage() {
  const [members, setMembers] = useState<AdminMember[] | null>(null)
  const [query, setQuery] = useState('')
  const [adjusting, setAdjusting] = useState<AdminMember | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState(false)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = (q?: string) =>
    supabase.rpc('admin_list_members' as never, { p_query: q ?? null } as never)
      .then(({ data, error }) => {
        if (error) { console.error('[admin]', error); setError(true) }
        else setMembers((data as unknown as AdminMember[] | null) ?? [])
      })
  useEffect(() => { load() }, [])

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    load(query.trim() || undefined)
  }

  const run = async (fn: string, args: Record<string, unknown>) => {
    setError(false)
    const { error } = await supabase.rpc(fn as never, args as never)
    if (error) { console.error('[admin]', error); setError(true) }
    await load(query.trim() || undefined)
  }

  const applyAdjust = async () => {
    if (!adjusting) return
    const n = parseInt(amount, 10)
    if (!n) return
    await run('admin_adjust_credits', { p_user_id: adjusting.id, p_amount: n, p_note: note.trim() || null })
    setAdjusting(null)
    setAmount('')
    setNote('')
  }

  return (
    <div>
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-6">{a.membersHeading}</h1>
      <form onSubmit={search} className="mb-6">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={a.searchMembers}
          className="w-full max-w-sm bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-2.5 text-sm outline-none text-white placeholder-gray-600"
        />
      </form>
      {error && <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2 mb-4">{a.actionFailed}</p>}
      {members === null ? (
        <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{a.loading}</p>
      ) : (
        <div className="overflow-x-auto border border-gray-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#111] text-gray-500 font-pixel text-[9px] tracking-widest">
                <th className="text-left px-4 py-3">{a.colMember}</th>
                <th className="text-left px-4 py-3">{a.colJoined}</th>
                <th className="text-right px-4 py-3">{a.colBalance}</th>
                <th className="text-right px-4 py-3">{a.colGames}</th>
                <th className="text-left px-4 py-3">{a.colRole}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {members.map(m => (
                <tr key={m.id} className={m.banned_at ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <p className="text-white">{m.username}{m.agent_name ? ` (${m.agent_name})` : ''}</p>
                    <p className="text-gray-600">{m.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(m.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right text-[#00ff41]">{m.balance.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{m.games_count}</td>
                  <td className="px-4 py-3">
                    <span className={`font-pixel text-[8px] tracking-widest ${m.role === 'admin' ? 'text-[#00ff41]' : 'text-gray-500'}`}>
                      {m.role === 'admin' ? a.roleAdmin : a.roleUser}
                    </span>
                    {m.banned_at && <span className="font-pixel text-[8px] text-red-400 ml-2">{a.bannedTag}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <button
                        onClick={() => run('admin_set_role', { p_user_id: m.id, p_role: m.role === 'admin' ? 'user' : 'admin' })}
                        className="font-pixel text-[8px] border border-gray-700 text-gray-400 px-2 py-1 hover:border-[#00ff41] hover:text-[#00ff41] transition-colors"
                      >
                        {m.role === 'admin' ? a.demote : a.promote}
                      </button>
                      {m.role !== 'admin' && (
                        <button
                          onClick={() => run('admin_set_ban', { p_user_id: m.id, p_banned: !m.banned_at })}
                          className="font-pixel text-[8px] border border-gray-700 text-gray-400 px-2 py-1 hover:border-red-400 hover:text-red-400 transition-colors"
                        >
                          {m.banned_at ? a.unban : a.ban}
                        </button>
                      )}
                      <button
                        onClick={() => setAdjusting(m)}
                        className="font-pixel text-[8px] border border-gray-700 text-gray-400 px-2 py-1 hover:border-[#00ff41] hover:text-[#00ff41] transition-colors"
                      >
                        ±
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjusting && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-4" onClick={() => setAdjusting(null)}>
          <div className="bg-[#111] border border-gray-800 p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="font-pixel text-[#00ff41] text-xs tracking-widest mb-1">{a.adjustCredits}</h2>
            <p className="text-gray-500 text-xs mb-4">{adjusting.email}</p>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={a.adjustAmount}
              className="w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none text-white placeholder-gray-500 mb-3"
            />
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={a.adjustNote}
              className="w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none text-white placeholder-gray-500 mb-4"
            />
            <button onClick={applyAdjust} className="w-full bg-[#00ff41] text-black font-pixel text-[11px] py-3 hover:bg-[#00cc33] transition-colors tracking-widest">
              {a.apply}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 검증** — `npx tsc --noEmit` 에러 0

- [ ] **Step 4: Commit**

```bash
git add app/admin/members/page.tsx lib/i18n/translations.ts
git commit -m "feat(admin): member management with role, ban, credit adjustment"
```

---

### Task 8: 게임 관리

**Files:**
- Create: `app/admin/games/page.tsx`
- Modify: `lib/i18n/translations.ts`

**Interfaces:**
- Consumes: `games` 테이블 (admin은 RLS상 select 전체 가능 — 공개 테이블), 수정/삭제는 admin RLS 필요 → **주의**: games의 기존 update/delete 정책은 소유자 기준일 수 있음. Step 1에서 admin 정책 추가.

- [ ] **Step 1: games admin 정책 추가** — `db/migrations/2026-07-15-admin-blog.sql` 끝에 추가(멱등):

```sql
-- 11) games: 관리자 수정/삭제 허용 (permissive — 기존 소유자 정책과 OR 결합)
drop policy if exists games_admin_update on public.games;
create policy games_admin_update on public.games for update using (public.is_admin());
drop policy if exists games_admin_delete on public.games;
create policy games_admin_delete on public.games for delete using (public.is_admin());
```

- [ ] **Step 2: i18n** — ko/en `admin` 섹션에 추가:

```ts
// ko
gamesHeading: '게임 관리',
searchGames: '게임 제목 검색',
sortNewest: '최신순',
sortViews: '조회순',
colGame: '게임',
colGenre: '장르',
colViews: '조회수',
colCreated: '등록일',
// en
gamesHeading: 'GAMES ADMIN',
searchGames: 'Search game title',
sortNewest: 'Newest',
sortViews: 'Most viewed',
colGame: 'Game',
colGenre: 'Genre',
colViews: 'Views',
colCreated: 'Created',
```

- [ ] **Step 3: 페이지** — `app/admin/games/page.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Game, Genre } from '@/lib/supabase/types'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[] | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'newest' | 'views'>('newest')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editGenre, setEditGenre] = useState<Genre>('action')
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = () => {
    let q = supabase.from('games').select('*')
    if (query.trim()) q = q.ilike('title', `%${query.trim()}%`)
    q = sort === 'views'
      ? q.order('view_count', { ascending: false })
      : q.order('created_at', { ascending: false })
    q.limit(200).then(({ data }) => setGames((data as Game[] | null) ?? []))
  }
  useEffect(() => { load() }, [sort])

  const startEdit = (g: Game) => {
    setEditingId(g.id)
    setEditTitle(g.title)
    setEditGenre(g.genre)
  }

  const saveEdit = async () => {
    if (!editingId) return
    const { error } = await supabase.from('games')
      .update({ title: editTitle.trim(), genre: editGenre } as never).eq('id', editingId)
    if (error) console.error('[admin]', error)
    setEditingId(null)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm(a.deleteConfirm)) return
    const { error } = await supabase.from('games').delete().eq('id', id)
    if (error) console.error('[admin]', error)
    load()
  }

  return (
    <div>
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-6">{a.gamesHeading}</h1>
      <div className="flex gap-3 mb-6 flex-wrap">
        <form onSubmit={e => { e.preventDefault(); load() }} className="flex-1 min-w-[200px] max-w-sm">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={a.searchGames}
            className="w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-2.5 text-sm outline-none text-white placeholder-gray-600"
          />
        </form>
        <div className="flex gap-1">
          {(['newest', 'views'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`font-pixel text-[9px] tracking-widest px-3 py-2 border transition-colors ${
                sort === s ? 'border-[#00ff41] text-[#00ff41]' : 'border-gray-800 text-gray-500 hover:text-white'
              }`}
            >
              {s === 'newest' ? a.sortNewest : a.sortViews}
            </button>
          ))}
        </div>
      </div>
      {games === null ? (
        <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{a.loading}</p>
      ) : (
        <div className="overflow-x-auto border border-gray-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#111] text-gray-500 font-pixel text-[9px] tracking-widest">
                <th className="text-left px-4 py-3">{a.colGame}</th>
                <th className="text-left px-4 py-3">{a.colGenre}</th>
                <th className="text-right px-4 py-3">{a.colViews}</th>
                <th className="text-left px-4 py-3">{a.colCreated}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {games.map(g => (
                <tr key={g.id}>
                  <td className="px-4 py-3">
                    {editingId === g.id ? (
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="w-full bg-[#0d0d0d] border border-[#00ff41] px-2 py-1 text-xs outline-none text-white"
                      />
                    ) : (
                      <a href={g.play_url} target="_blank" rel="noreferrer" className="text-white hover:text-[#00ff41] transition-colors">
                        {g.title}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === g.id ? (
                      <select
                        value={editGenre}
                        onChange={e => setEditGenre(e.target.value as Genre)}
                        className="bg-[#0d0d0d] border border-[#00ff41] px-2 py-1 text-xs outline-none text-white"
                      >
                        {GENRES.map(x => <option key={x} value={x}>{T.genres[x]}</option>)}
                      </select>
                    ) : (
                      <span className="text-gray-400">{T.genres[g.genre]}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{(g.view_count ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(g.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {editingId === g.id ? (
                        <>
                          <button onClick={saveEdit} className="font-pixel text-[8px] bg-[#00ff41] text-black px-2 py-1">{a.save}</button>
                          <button onClick={() => setEditingId(null)} className="font-pixel text-[8px] border border-gray-700 text-gray-400 px-2 py-1">{a.cancel}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(g)} className="font-pixel text-[8px] border border-gray-700 text-gray-400 px-2 py-1 hover:border-[#00ff41] hover:text-[#00ff41] transition-colors">{a.edit}</button>
                          <button onClick={() => remove(g.id)} className="font-pixel text-[8px] border border-gray-700 text-gray-400 px-2 py-1 hover:border-red-400 hover:text-red-400 transition-colors">{a.delete}</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 검증** — `npx tsc --noEmit` 에러 0

- [ ] **Step 5: Commit**

```bash
git add app/admin/games/page.tsx db/migrations/2026-07-15-admin-blog.sql lib/i18n/translations.ts
git commit -m "feat(admin): game management with search, edit, delete"
```

---

### Task 9: 설정 페이지 + 생성 비용/밴 집행 연동

**Files:**
- Create: `app/admin/settings/page.tsx`
- Modify: `app/api/studio/generate/route.ts`, `lib/i18n/translations.ts`

**Interfaces:**
- Consumes: `site_settings` (Task 1), 기존 generate route의 `spend_credits`/환불 흐름
- Produces: generate route가 `site_settings.generation_cost`를 사용하고 밴 유저에 403 `BANNED` 반환

- [ ] **Step 1: i18n** — ko/en `admin` 섹션에 추가:

```ts
// ko
settingsHeading: '설정',
setSignupBonus: '가입 보너스 크레딧',
setGenerationCost: '게임 생성 1회 비용',
setBanner: '홈 배너',
setBannerEnabled: '배너 표시',
setBannerText: '배너 문구',
setBannerLink: '배너 링크 (선택, 예: /notices)',
// en
settingsHeading: 'SETTINGS',
setSignupBonus: 'Signup bonus credits',
setGenerationCost: 'Cost per generation',
setBanner: 'Home banner',
setBannerEnabled: 'Show banner',
setBannerText: 'Banner text',
setBannerLink: 'Banner link (optional, e.g. /notices)',
```

- [ ] **Step 2: 설정 페이지** — `app/admin/settings/page.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BannerSetting, SiteSetting } from '@/lib/supabase/types'

export default function AdminSettingsPage() {
  const [loaded, setLoaded] = useState(false)
  const [signupBonus, setSignupBonus] = useState('30')
  const [generationCost, setGenerationCost] = useState('10')
  const [bannerEnabled, setBannerEnabled] = useState(false)
  const [bannerText, setBannerText] = useState('')
  const [bannerLink, setBannerLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<'saved' | 'failed' | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  useEffect(() => {
    supabase.from('site_settings').select('*').then(({ data }) => {
      for (const row of (data as SiteSetting[] | null) ?? []) {
        if (row.key === 'signup_bonus') setSignupBonus(String(row.value))
        if (row.key === 'generation_cost') setGenerationCost(String(row.value))
        if (row.key === 'banner') {
          const b = row.value as BannerSetting
          setBannerEnabled(!!b.enabled)
          setBannerText(b.text ?? '')
          setBannerLink(b.link ?? '')
        }
      }
      setLoaded(true)
    })
  }, [])

  const save = async () => {
    if (saving) return
    setSaving(true)
    setMsg(null)
    const rows = [
      { key: 'signup_bonus', value: Math.max(0, parseInt(signupBonus, 10) || 0), updated_at: new Date().toISOString() },
      { key: 'generation_cost', value: Math.max(1, parseInt(generationCost, 10) || 1), updated_at: new Date().toISOString() },
      { key: 'banner', value: { enabled: bannerEnabled, text: bannerText.trim(), link: bannerLink.trim() }, updated_at: new Date().toISOString() },
    ]
    const { error } = await supabase.from('site_settings').upsert(rows as never)
    if (error) { console.error('[admin]', error); setMsg('failed') }
    else setMsg('saved')
    setSaving(false)
  }

  if (!loaded) return <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{a.loading}</p>

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-500'
  const labelClass = 'block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest'

  return (
    <div className="max-w-lg">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-8">{a.settingsHeading}</h1>
      <div className="space-y-6">
        <div>
          <label className={labelClass}>{a.setSignupBonus}</label>
          <input type="number" min={0} value={signupBonus} onChange={e => setSignupBonus(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{a.setGenerationCost}</label>
          <input type="number" min={1} value={generationCost} onChange={e => setGenerationCost(e.target.value)} className={inputClass} />
        </div>
        <div className="border border-gray-800 bg-[#111] p-5 space-y-4">
          <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{a.setBanner}</p>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={bannerEnabled} onChange={e => setBannerEnabled(e.target.checked)} className="accent-[#00ff41]" />
            {a.setBannerEnabled}
          </label>
          <input value={bannerText} onChange={e => setBannerText(e.target.value)} placeholder={a.setBannerText} className={inputClass} />
          <input value={bannerLink} onChange={e => setBannerLink(e.target.value)} placeholder={a.setBannerLink} className={inputClass} />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={save} disabled={saving} className="font-pixel text-[10px] tracking-widest bg-[#00ff41] text-black px-6 py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50">
            {a.save}
          </button>
          {msg === 'saved' && <span className="text-[#00ff41] text-xs">{a.saved}</span>}
          {msg === 'failed' && <span className="text-red-400 text-xs">{a.saveFailed}</span>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: generate route 연동** — `app/api/studio/generate/route.ts` 수정.

인증 확인(401 반환) 직후, `spend_credits` 호출 전에 추가:

```ts
// 밴 유저 차단 + 생성 비용을 설정에서 읽기 (실패 시 GENERATION_COST 폴백)
const { data: profileRow } = await supabase
  .from('profiles').select('banned_at').eq('id', user.id).maybeSingle()
if ((profileRow as { banned_at?: string | null } | null)?.banned_at) {
  return new Response(JSON.stringify({ error: 'BANNED' }), { status: 403 })
}
const { data: costRow } = await supabase
  .from('site_settings').select('value').eq('key', 'generation_cost').maybeSingle()
const parsedCost = Number((costRow as { value?: unknown } | null)?.value)
const cost = Number.isFinite(parsedCost) && parsedCost >= 1 ? parsedCost : GENERATION_COST
```

그리고 라우트 내 `GENERATION_COST`를 쓰던 모든 자리(`spend_credits`의 `p_amount`, 환불 헬퍼의 amount)를 `cost`로 교체. `GENERATION_COST` import는 폴백용으로 유지.

- [ ] **Step 4: 검증** — `npx tsc --noEmit` 에러 0, `npm run build` 성공

- [ ] **Step 5: Commit**

```bash
git add app/admin/settings/page.tsx app/api/studio/generate/route.ts lib/i18n/translations.ts
git commit -m "feat(admin): settings page; generation cost from settings; ban enforcement"
```

---

### Task 10: 최종 검증 + 배포

**Files:** 없음 (검증/배포만)

- [ ] **Step 1: 전체 게이트**

Run: `npm test` → 전체 PASS
Run: `npx tsc --noEmit` → 에러 0
Run: `npm run build` → 성공
Run: `npx next lint` (또는 기존 lint 스크립트) → 신규 에러 0 (기존 5건 제외)

- [ ] **Step 2: 마이그레이션 라이브 적용 확인** — `2026-07-15-admin-blog.sql`을 Supabase에 적용(사용자 안내 또는 psql). REST로 스모크: `blog_posts` 테이블 200 응답, `admin_dashboard_stats` RPC가 비로그인에서 에러 응답.

- [ ] **Step 3: 로컬 수동 확인** — `npm run dev`: 관리자 계정으로 `/admin` 접근(대시보드 렌더), 일반/비로그인 리다이렉트, 블로그 글 작성→발행→`/blog` 노출, 공지 작성→`/notices` 노출, 배너 on→홈 표시.

- [ ] **Step 4: 커밋/머지/배포**

```bash
git push && vercel --prod --yes
```

프로덕션 스모크: `/blog`·`/notices` 200, `/admin` 비로그인 시 리다이렉트.
