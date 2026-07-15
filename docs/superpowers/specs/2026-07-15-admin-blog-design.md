# Admin Panel + Blog — Design Spec

Date: 2026-07-15
Status: Approved by user (chat)

## Goal

vibrax에 (1) 관리자 전용 블로그(티스토리 스타일: 카테고리·썸네일·WYSIWYG 에디터·본문 이미지 업로드), (2) 공지 게시판, (3) 관리자 페이지(대시보드·게임·블로그·공지·회원·설정 관리)를 추가한다. 1인 운영 게임 플랫폼이므로 대시보드는 운영자가 한눈에 지표를 보는 화면이다.

기본 관리자: `puridev1155@gmail.com` 계정(기존 로그인 그대로, 별도 admin 계정 없음). 이후 관리자 화면에서 다른 회원을 승격/해제할 수 있다.

## Decisions (user-confirmed)

- 에디터: **Tiptap WYSIWYG** (툴바 + 본문 이미지 업로드)
- 공지: **별도 게시판 페이지**(`/notices`) + 홈 상단 배너(설정에서 on/off·문구·링크)
- 회원 관리: 관리자 승격/해제, 크레딧 수동 지급/차감, 회원 정지(밴)
- 설정: 크레딧 정책(가입 보너스·생성 비용) + 홈 배너, 그 외는 최소로
- 관리자 판별: `profiles.role` 컬럼 + `is_admin()` SQL 함수 + RLS (JWT claims·env 허용목록 대신 — UI 승격/해제와 DB 레벨 보호를 모두 충족)

## DB — `db/migrations/2026-07-15-admin-blog.sql`

멱등(idempotent) 작성: `if not exists` / `drop policy if exists` / `on conflict do nothing`.

### profiles 확장
- `role text not null default 'user' check (role in ('user','admin'))`
- `banned_at timestamptz` (null = 정상)
- `is_admin() returns boolean` — `security definer, stable`: `exists(select 1 from profiles where id = auth.uid() and role='admin')`. authenticated에 grant.
- 시드: `update profiles set role='admin' where id in (select id from auth.users where email='puridev1155@gmail.com')`

### 신규 테이블 + RLS
- `blog_categories(id, name, slug unique, sort_order, created_at)` — 읽기 공개, 쓰기 `is_admin()`
- `blog_posts(id, category_id fk set null, author_id fk profiles, title, thumbnail_url, content text /*Tiptap HTML*/, excerpt, published bool default false, published_at, view_count int default 0, created_at, updated_at)` — 읽기 `published or is_admin()`, 쓰기 `is_admin()`
- `notices(id, title, content text, pinned bool default false, published bool default true, created_at, updated_at)` — 읽기 `published or is_admin()`, 쓰기 `is_admin()`
- `site_settings(key text pk, value jsonb, updated_at)` — 읽기 공개(배너·생성비용 노출 필요), 쓰기 `is_admin()`. 시드: `signup_bonus=30`, `generation_cost=10`, `banner={"enabled":false,"text":"","link":""}`

### 크레딧/정책 연동
- `credit_ledger` reason check 제약에 `'admin_adjust'` 추가 (drop constraint if exists 후 재생성)
- `grant_signup_bonus()` 수정: 지급액을 `site_settings.signup_bonus`에서 읽음 (없으면 30)
- 생성 비용: generate route가 `site_settings.generation_cost`를 읽어 `spend_credits(cost, ref)` 호출 (상수 `GENERATION_COST`는 fallback)

### 밴 집행
- games / studio_projects insert RLS 정책에 `banned_at is null` 조건 추가 (기존 정책 drop 후 재생성)
- generate route: 요청 초입에 profile.banned_at 확인 → 403 `BANNED`

### 관리자 RPC (모두 security definer, 첫 줄에서 `is_admin()` 아니면 `NOT_ADMIN` 예외)
- `admin_dashboard_stats() returns jsonb` — 한 번 호출로 대시보드 전체:
  - totals: 회원 수, 게임 수, 게임 조회수 합, 생성 횟수(ledger reason=generation count), 구매 크레딧 합, 소진 크레딧 합
  - daily(최근 30일, 날짜별): 가입 수, 게임 게시 수, 생성 수, 구매 건수
- `admin_list_members(p_query text default null) returns table(...)` — auth.users(email) ⋈ profiles ⋈ 크레딧 잔액 ⋈ 게임 수. 검색은 email/username ilike.
- `admin_set_role(p_user_id, p_role)` — 자기 자신의 role 변경 금지(마지막 관리자 잠금 방지)
- `admin_set_ban(p_user_id, p_banned boolean)` — 자기 자신·관리자 밴 금지
- `admin_adjust_credits(p_user_id, p_amount int, p_note text)` — ledger에 `admin_adjust`로 기록(ref_id=note). 음수 허용(관리자 재량)

### Storage
- `blog-images` 공개 버킷 (thumbnails 버킷 패턴 그대로). 업로드는 admin만(storage RLS에서 `is_admin()`).

## 관리자 페이지 `/admin/*`

- `app/admin/layout.tsx` — 서버 컴포넌트 가드: 미로그인 → `/login?redirect=/admin`, 비관리자 → `/`. 사이드바(대시보드/게임/블로그/공지/회원/설정), 모바일은 상단 탭. 기존 픽셀·네온그린(#00ff41) 테마 유지.
- `app/admin/page.tsx` — **대시보드**: KPI 카드 6개(totals) + 최근 30일 일별 차트(가입·게시·생성·구매). 차트는 외부 라이브러리 없이 경량 SVG(레트로 감성의 라인/바) — `components/admin/charts.tsx`.
- `app/admin/games/page.tsx` — 전체 게임 테이블(검색·최신/조회순 정렬), 제목·장르 인라인 수정, 삭제(확인 후).
- `app/admin/blog/page.tsx` — 글 목록(발행상태 표시) + 카테고리 관리(추가/이름변경/삭제). `app/admin/blog/new/page.tsx`, `app/admin/blog/[id]/page.tsx` — 작성/수정 폼: 제목, 카테고리 select, 썸네일 업로드, Tiptap 에디터, 발행 토글, 저장(비발행 = 임시저장).
- `app/admin/notices/page.tsx` — 목록 + 작성/수정(같은 에디터 재사용), pinned·published 토글.
- `app/admin/members/page.tsx` — 회원 테이블(이메일·이름·가입일·잔액·게임 수·role·밴 상태), 검색, 승격/해제·밴/해제 버튼, 크레딧 조정 모달(±금액, 메모).
- `app/admin/settings/page.tsx` — signup_bonus, generation_cost, 배너(enabled/text/link) 폼 → site_settings upsert.
- NavBar: 관리자에게만 "관리자" 링크 표시(프로필 role 조회).

## 에디터 — `components/admin/RichTextEditor.tsx`

- Tiptap: `@tiptap/react`, `starter-kit`, `extension-image`, `extension-link`, `extension-placeholder`
- 툴바: 굵게/기울임/취소선, H2/H3, 목록(순서/비순서), 인용, 코드블록, 링크, 이미지 업로드, 구분선, 실행취소/재실행
- 이미지 업로드: 파일 선택(또는 드롭) → `blog-images` 버킷 업로드 → public URL을 image 노드로 삽입
- 출력: HTML 문자열을 `blog_posts.content`에 저장

**신뢰 경계**: content는 admin만 작성 가능하므로 렌더링 시 `dangerouslySetInnerHTML` 허용(별도 sanitize 없음). 이 전제는 RLS(`is_admin()` 쓰기 제한)가 보장한다.

## 공개 페이지

- `app/blog/page.tsx` — 썸네일 카드 그리드 + 카테고리 필터 탭, 발행글만.
- `app/blog/[id]/page.tsx` — 제목/카테고리/날짜/썸네일 + 본문 HTML 렌더, 조회수 증가는 `increment_blog_view(p_post_id)` security definer RPC.
- `app/notices/page.tsx` — 목록(pinned 상단 고정), `app/notices/[id]/page.tsx` 상세.
- `components/HomeBanner.tsx` — site_settings.banner 읽어 enabled면 홈 최상단 얇은 배너(문구+링크). `app/page.tsx`에 배치.
- NavBar에 블로그·공지 링크(데스크톱+모바일).
- i18n: `blog.*`, `notices.*`, `admin.*` 키 ko/en 완전 패리티.

## 구현 순서 (SDD 태스크 단계)

1. 마이그레이션(전체 스키마+RPC) + types.ts 확장 → 라이브 적용
2. 관리자 레이아웃/가드 + NavBar 관리자 링크
3. 대시보드(stats RPC + SVG 차트)
4. RichTextEditor 컴포넌트
5. 블로그 관리(목록/카테고리/작성/수정) + 공개 블로그
6. 공지 관리 + 공개 공지 + 홈 배너
7. 회원 관리
8. 게임 관리
9. 설정 페이지 + signup_bonus/generation_cost 연동 + 밴 집행
10. i18n 정리, 테스트, 빌드 검증, 배포

## 테스트

- node:test (`lib/**/*.test.ts`): excerpt 생성(HTML strip + 자르기), 대시보드 daily 시계열 빈 날짜 채우기 헬퍼, settings 파싱 헬퍼
- 검증 게이트: `npm test`, `tsc --noEmit`, `next lint`(신규 에러 0), `next build`
- 수동: 관리자/비관리자 접근, 블로그 발행→공개 노출, 밴 회원 생성 차단, 크레딧 조정 후 잔액 반영

## Out of scope

- 댓글, 블로그 검색/태그, RSS
- 회원 삭제(탈퇴 처리), 이메일 발송
- 정교한 트래픽 분석(페이지뷰 추적 테이블) — 현재 데이터(가입·게시·생성·구매·조회수)로만 대시보드 구성
