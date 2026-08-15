# Vibrax Studio (프롬프트 게임 제작 + 크레딧 결제) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스튜디오 메뉴에서 왼쪽 채팅으로 프롬프트를 보내면 Claude가 단일 HTML 게임을 생성해 오른쪽 iframe에 띄우고, 생성마다 크레딧을 차감하며 Paddle로 충전하는 기능.

**Architecture:** Next.js App Router + Supabase(테이블 4개, SECURITY DEFINER 크레딧 함수) + Anthropic 스트리밍(기존 `app/api/user-agent/chat/route.ts` 패턴 재사용). 게임은 매 요청 전체 재생성되어 `studio_versions`에 버전으로 쌓이고, sandboxed iframe(srcdoc)으로 프리뷰. 크레딧 지급은 Paddle 웹훅 단일 진입점.

**Tech Stack:** Next.js 16 / React 19 / Supabase / @anthropic-ai/sdk / @paddle/paddle-js / Tailwind 4 / node:test

**Spec:** `docs/superpowers/specs/2026-07-09-studio-prompt-game-creation-design.md`

## Global Constraints

- 생성 모델: `claude-sonnet-5`, 응답 형식: 짧은 설명 텍스트 → `<game>완결된 단일 HTML</game>`
- 생성/수정 1회 = **10 크레딧**, 가입 보너스 **30 크레딧**(1회), 팩: $5=100 / $20=450 / $50=1,250
- 크레딧 잔액은 balance 컬럼 없이 `credit_ledger` 합산. `credit_ledger`에 클라이언트 INSERT 정책 없음 — 쓰기는 SECURITY DEFINER 함수와 service role만
- 크레딧 지급의 유일한 진입점은 Paddle 웹훅(`transaction.completed`). ref_id(트랜잭션 id) partial unique index로 중복 지급 차단
- 생성 실패 시 크레딧 자동 환불(reason='refund', 같은 ref_id, 이중 환불은 unique index로 차단)
- 프리뷰 iframe은 `sandbox="allow-scripts"`, `/play/[id]`는 CSP sandbox 헤더로 서빙
- 생성된 게임 HTML은 외부 리소스(CDN/이미지 URL/폰트) 금지 — 시스템 프롬프트에 명시
- UI 문자열은 `lib/i18n/translations.ts`에 ko/en 모두 추가. 디자인 토큰: `#00ff41`, `font-pixel`, 배경 `#0a0a0a`/`#111`, `border-gray-800`
- 테스트: `npm test` (node:test, `lib/**/*.test.ts`). 커밋 자주.
- 환경변수(신규): `SUPABASE_SERVICE_ROLE_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_ENV`(`sandbox`|`production`), `NEXT_PUBLIC_PADDLE_PRICE_SMALL/MEDIUM/LARGE`. 기존: `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## File Structure

| 파일 | 역할 |
|---|---|
| `db/migrations/2026-07-09-studio.sql` | Create: 테이블 4개 + RLS + 크레딧 함수 + games 컬럼 |
| `lib/supabase/types.ts` | Modify: Studio/Credit 타입 + Database 테이블 추가 |
| `lib/supabase/admin.ts` | Create: service role 클라이언트 (웹훅·/play 전용) |
| `lib/studio/constants.ts` | Create: 크레딧 상수, 팩 정의, price id 매핑 |
| `lib/studio/parse.ts` (+`.test.ts`) | Create: 스트림 텍스트 → 설명/HTML 파싱, 제목 추출, 에러 마커 |
| `lib/studio/prompt.ts` (+`.test.ts`) | Create: 시스템 프롬프트 + 메시지 조립 |
| `lib/paddle/verify.ts` (+`.test.ts`) | Create: Paddle 웹훅 서명 검증 (HMAC-SHA256) |
| `app/api/studio/generate/route.ts` | Create: 차감→스트리밍 생성→저장/환불 |
| `app/api/webhooks/paddle/route.ts` | Create: 서명 검증 → 크레딧 지급 |
| `app/studio/page.tsx` | Create: 프로젝트 목록 + 새 게임 + 잔액 + 보너스 지급 |
| `app/studio/[id]/page.tsx` | Create: 제작 화면 오케스트레이션 (좌 채팅/우 프리뷰) |
| `components/studio/StudioChat.tsx` | Create: 메시지 목록 + 스트리밍 표시 + 입력 |
| `components/studio/GamePreview.tsx` | Create: sandboxed iframe + 툴바(새로고침/버전/게시) |
| `components/studio/PublishModal.tsx` | Create: 제목/장르/썸네일 → games INSERT |
| `app/credits/page.tsx` | Create: 팩 선택 + Paddle Overlay Checkout |
| `app/play/[id]/route.ts` | Create: 게시된 프로젝트의 최신 HTML 서빙 |
| `components/NavBar.tsx` | Modify: 스튜디오 링크 (데스크톱 + 모바일) |
| `lib/i18n/translations.ts` | Modify: `nav.studio`, `studio.*`, `credits.*` (ko/en) |

스펙과의 차이 1건(의도적): `studio_messages`/`studio_versions` INSERT는 service role 전용이 아니라 "본인 프로젝트에 한해" RLS로 허용. generate 라우트가 사용자 세션으로 동작하므로 service role이 불필요해지고, 사용자가 자기 프로젝트에 행을 넣어도 금전 영향이 없다. `credit_ledger`만 엄격하게 잠근다.

---

### Task 1: DB 마이그레이션 + 타입

**Files:**
- Create: `db/migrations/2026-07-09-studio.sql`
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Produces (DB RPC, 이후 모든 태스크가 사용):
  - `credit_balance() returns int`
  - `spend_credits(p_amount int, p_ref text) returns int` — 부족 시 `INSUFFICIENT_CREDITS` 예외
  - `refund_credits(p_amount int, p_ref text) returns void` — 같은 ref의 차감 건 필수
  - `grant_signup_bonus() returns int` — 1회만 +30, 항상 현재 잔액 반환
- Produces (TS 타입): `StudioProject`, `StudioMessage`, `StudioVersion`, `StudioVersionMeta`, `CreditLedgerEntry`, `Game.studio_project_id`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- db/migrations/2026-07-09-studio.sql
-- Studio: 프롬프트 게임 제작 프로젝트/채팅/버전 + 크레딧 원장.
-- 잔액은 credit_ledger 합산으로만 계산. 클라이언트는 credit_ledger에 INSERT 불가 —
-- 쓰기는 SECURITY DEFINER 함수(spend/refund/bonus)와 service role(웹훅 지급)만.

create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  title text not null default '새 게임',
  created_at timestamptz default now()
);

create table if not exists public.studio_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);

create table if not exists public.studio_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  version int not null,
  html text not null,
  created_at timestamptz default now(),
  unique (project_id, version)
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount int not null,
  reason text not null check (reason in ('purchase','generation','refund','signup_bonus')),
  ref_id text,
  created_at timestamptz default now()
);

-- 중복 방지: 결제 이중 지급 / 가입 보너스 중복 / 이중 환불
create unique index if not exists credit_ledger_purchase_ref
  on public.credit_ledger (ref_id) where reason = 'purchase';
create unique index if not exists credit_ledger_signup_once
  on public.credit_ledger (user_id) where reason = 'signup_bonus';
create unique index if not exists credit_ledger_refund_ref
  on public.credit_ledger (ref_id) where reason = 'refund';

alter table public.games
  add column if not exists studio_project_id uuid references public.studio_projects(id);

alter table public.studio_projects enable row level security;
alter table public.studio_messages enable row level security;
alter table public.studio_versions enable row level security;
alter table public.credit_ledger enable row level security;

create policy "own projects select" on public.studio_projects
  for select using (user_id = auth.uid());
create policy "own projects insert" on public.studio_projects
  for insert with check (user_id = auth.uid());
create policy "own projects update" on public.studio_projects
  for update using (user_id = auth.uid());
create policy "own projects delete" on public.studio_projects
  for delete using (user_id = auth.uid());

create policy "own messages select" on public.studio_messages for select
  using (exists (select 1 from public.studio_projects p
                 where p.id = project_id and p.user_id = auth.uid()));
create policy "own messages insert" on public.studio_messages for insert
  with check (exists (select 1 from public.studio_projects p
                      where p.id = project_id and p.user_id = auth.uid()));

create policy "own versions select" on public.studio_versions for select
  using (exists (select 1 from public.studio_projects p
                 where p.id = project_id and p.user_id = auth.uid()));
create policy "own versions insert" on public.studio_versions for insert
  with check (exists (select 1 from public.studio_projects p
                      where p.id = project_id and p.user_id = auth.uid()));

-- 원장: 본인 조회만. INSERT/UPDATE/DELETE 정책 없음(= 함수/service role 외 차단)
create policy "own ledger select" on public.credit_ledger
  for select using (user_id = auth.uid());

create or replace function public.credit_balance() returns int
language sql security definer set search_path = public as
$$ select coalesce(sum(amount), 0)::int from credit_ledger where user_id = auth.uid() $$;

-- 원자적 차감: 사용자별 advisory lock으로 동시 요청에도 음수 잔액 불가
create or replace function public.spend_credits(p_amount int, p_ref text) returns int
language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select coalesce(sum(amount), 0) into v_balance
    from credit_ledger where user_id = auth.uid();
  if v_balance < p_amount then raise exception 'INSUFFICIENT_CREDITS'; end if;
  insert into credit_ledger (user_id, amount, reason, ref_id)
    values (auth.uid(), -p_amount, 'generation', p_ref);
  return v_balance - p_amount;
end $$;

-- 환불: 같은 ref의 차감 건이 있어야만 지급(임의 호출로 크레딧 생성 불가),
-- credit_ledger_refund_ref 인덱스가 이중 환불 차단
create or replace function public.refund_credits(p_amount int, p_ref text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from credit_ledger
                 where user_id = auth.uid() and reason = 'generation'
                   and ref_id = p_ref and amount = -p_amount) then
    raise exception 'NO_MATCHING_SPEND';
  end if;
  insert into credit_ledger (user_id, amount, reason, ref_id)
    values (auth.uid(), p_amount, 'refund', p_ref);
end $$;

-- 가입 보너스 30크레딧 1회 지급, 항상 현재 잔액 반환
create or replace function public.grant_signup_bonus() returns int
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  insert into credit_ledger (user_id, amount, reason)
    values (auth.uid(), 30, 'signup_bonus')
    on conflict (user_id) where reason = 'signup_bonus' do nothing;
  return (select coalesce(sum(amount), 0)::int
            from credit_ledger where user_id = auth.uid());
end $$;

grant execute on function public.credit_balance() to authenticated;
grant execute on function public.spend_credits(int, text) to authenticated;
grant execute on function public.refund_credits(int, text) to authenticated;
grant execute on function public.grant_signup_bonus() to authenticated;
```

- [ ] **Step 2: Supabase에 적용**

Supabase 대시보드 → SQL Editor에 위 파일 내용 붙여넣고 실행 (기존 마이그레이션과 동일한 수동 적용 방식).
Expected: `Success. No rows returned`

- [ ] **Step 3: 함수 동작 확인 (SQL Editor)**

```sql
-- 아무 사용자로도 로그인하지 않은 SQL Editor에서는 auth.uid()가 null이므로
-- 테이블/인덱스 존재만 확인:
select count(*) from public.studio_projects;
select indexname from pg_indexes where tablename = 'credit_ledger';
```
Expected: `0` / 인덱스 3개(`credit_ledger_purchase_ref`, `credit_ledger_signup_once`, `credit_ledger_refund_ref`) 표시

- [ ] **Step 4: 타입 추가** — `lib/supabase/types.ts`의 `Database` 타입 위에 인터페이스 추가, `Game`에 컬럼 추가, `Database.Tables`에 4개 테이블 추가

```ts
// Game 인터페이스에 추가 (view_count 아래):
  studio_project_id?: string | null

// Profile 아래에 추가:
export interface StudioProject {
  id: string
  user_id: string
  title: string
  created_at: string
}

export interface StudioMessage {
  id: string
  project_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface StudioVersion {
  id: string
  project_id: string
  version: number
  html: string
  created_at: string
}

// 버전 목록 표시용 (html 제외 — 목록에서 대용량 컬럼을 내려받지 않기 위함)
export type StudioVersionMeta = Pick<StudioVersion, 'id' | 'version' | 'created_at'>

export interface CreditLedgerEntry {
  id: string
  user_id: string
  amount: number
  reason: 'purchase' | 'generation' | 'refund' | 'signup_bonus'
  ref_id: string | null
  created_at: string
}
```

`Database.Tables`에 games/profiles와 같은 패턴으로 추가:

```ts
      studio_projects: {
        Row: StudioProject
        Insert: Omit<StudioProject, 'id' | 'created_at' | 'title'> & {
          id?: string; created_at?: string; title?: string
        }
        Update: Partial<Omit<StudioProject, 'id'>>
        Relationships: []
      }
      studio_messages: {
        Row: StudioMessage
        Insert: Omit<StudioMessage, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<StudioMessage, 'id'>>
        Relationships: []
      }
      studio_versions: {
        Row: StudioVersion
        Insert: Omit<StudioVersion, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<StudioVersion, 'id'>>
        Relationships: []
      }
      credit_ledger: {
        Row: CreditLedgerEntry
        Insert: Omit<CreditLedgerEntry, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: never
        Relationships: []
      }
```

- [ ] **Step 5: 린트 확인 후 커밋**

```bash
npm run lint && git add db/migrations/2026-07-09-studio.sql lib/supabase/types.ts
git commit -m "feat(studio): add studio tables, credit ledger, and credit functions"
```

---

### Task 2: 크레딧 상수 + 스트림 파싱 (TDD)

**Files:**
- Create: `lib/studio/constants.ts`
- Create: `lib/studio/parse.ts`
- Test: `lib/studio/parse.test.ts`, `lib/studio/constants.test.ts`

**Interfaces:**
- Produces:
  - `GENERATION_COST = 10`, `SIGNUP_BONUS = 30`
  - `CREDIT_PACKS: { key: 'small'|'medium'|'large'; usd: number; credits: number }[]`
  - `packPriceId(key): string | undefined` — `NEXT_PUBLIC_PADDLE_PRICE_*` env 조회
  - `creditsForPriceId(priceId: string | undefined): number` — 미매칭 시 0
  - `GEN_ERROR_MARKER: string`
  - `parseGeneration(text: string): { description: string; html: string | null; htmlBytes: number; generating: boolean }`
  - `hasGenError(text: string): boolean`
  - `extractTitle(html: string): string | null`

- [ ] **Step 1: 실패하는 테스트 작성** — `lib/studio/parse.test.ts`

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseGeneration, hasGenError, extractTitle, GEN_ERROR_MARKER } from './parse'

test('game 태그 이전 텍스트만 있으면 description만 채운다', () => {
  const p = parseGeneration('점프 게임을 만들고 있어요.')
  assert.equal(p.description, '점프 게임을 만들고 있어요.')
  assert.equal(p.html, null)
  assert.equal(p.generating, false)
})

test('열림 태그만 있으면 generating=true, htmlBytes는 부분 길이', () => {
  const p = parseGeneration('설명입니다.\n<game><!DOCTYPE html><html>')
  assert.equal(p.description, '설명입니다.')
  assert.equal(p.html, null)
  assert.equal(p.generating, true)
  assert.equal(p.htmlBytes, '<!DOCTYPE html><html>'.length)
})

test('닫힘 태그까지 있으면 html을 추출한다', () => {
  const p = parseGeneration('완성!\n<game>\n<!DOCTYPE html><html><body>hi</body></html>\n</game>\n')
  assert.equal(p.description, '완성!')
  assert.equal(p.html, '<!DOCTYPE html><html><body>hi</body></html>')
  assert.equal(p.generating, false)
})

test('에러 마커를 감지하고 파싱에서는 제거한다', () => {
  const text = '설명' + GEN_ERROR_MARKER
  assert.equal(hasGenError(text), true)
  assert.equal(parseGeneration(text).description, '설명')
})

test('extractTitle은 title 태그 내용을 돌려준다', () => {
  assert.equal(extractTitle('<html><head><title>PIXEL JUMP</title></head></html>'), 'PIXEL JUMP')
  assert.equal(extractTitle('<html></html>'), null)
})
```

`lib/studio/constants.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CREDIT_PACKS, GENERATION_COST, creditsForPriceId, packPriceId } from './constants'

test('팩 정의는 스펙 금액/크레딧과 일치한다', () => {
  assert.equal(GENERATION_COST, 10)
  assert.deepEqual(CREDIT_PACKS.map(p => [p.usd, p.credits]), [[5, 100], [20, 450], [50, 1250]])
})

test('creditsForPriceId는 env의 price id를 크레딧으로 매핑한다', () => {
  process.env.NEXT_PUBLIC_PADDLE_PRICE_SMALL = 'pri_test_small'
  assert.equal(packPriceId('small'), 'pri_test_small')
  assert.equal(creditsForPriceId('pri_test_small'), 100)
  assert.equal(creditsForPriceId('pri_unknown'), 0)
  assert.equal(creditsForPriceId(undefined), 0)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './parse'` / `'./constants'`

- [ ] **Step 3: 구현** — `lib/studio/parse.ts`

```ts
// 생성 스트림 텍스트 파싱. 모델 출력 형식: "짧은 설명\n<game>완결된 HTML</game>"
// 클라이언트는 누적 텍스트를 매 청크마다 통째로 다시 파싱한다(상태 없는 파서).

export const GEN_ERROR_MARKER = '\n[[GEN_ERROR]]'

export interface ParsedGeneration {
  description: string
  html: string | null
  htmlBytes: number
  generating: boolean
}

export function parseGeneration(text: string): ParsedGeneration {
  const clean = text.split(GEN_ERROR_MARKER).join('')
  const open = clean.indexOf('<game>')
  if (open === -1) {
    return { description: clean.trim(), html: null, htmlBytes: 0, generating: false }
  }
  const description = clean.slice(0, open).trim()
  const rest = clean.slice(open + '<game>'.length)
  const close = rest.indexOf('</game>')
  if (close === -1) {
    return { description, html: null, htmlBytes: rest.length, generating: true }
  }
  return { description, html: rest.slice(0, close).trim(), htmlBytes: close, generating: false }
}

export function hasGenError(text: string): boolean {
  return text.includes(GEN_ERROR_MARKER)
}

export function extractTitle(html: string): string | null {
  const m = html.match(/<title>([^<]{1,60})<\/title>/i)
  return m ? m[1].trim() : null
}
```

`lib/studio/constants.ts`:

```ts
export const GENERATION_COST = 10
// SIGNUP_BONUS는 표시용 — 실제 지급액은 migration의 grant_signup_bonus()에 있다
export const SIGNUP_BONUS = 30

export interface CreditPack {
  key: 'small' | 'medium' | 'large'
  usd: number
  credits: number
}

export const CREDIT_PACKS: CreditPack[] = [
  { key: 'small', usd: 5, credits: 100 },
  { key: 'medium', usd: 20, credits: 450 },
  { key: 'large', usd: 50, credits: 1250 },
]

export function packPriceId(key: CreditPack['key']): string | undefined {
  const map: Record<CreditPack['key'], string | undefined> = {
    small: process.env.NEXT_PUBLIC_PADDLE_PRICE_SMALL,
    medium: process.env.NEXT_PUBLIC_PADDLE_PRICE_MEDIUM,
    large: process.env.NEXT_PUBLIC_PADDLE_PRICE_LARGE,
  }
  return map[key]
}

export function creditsForPriceId(priceId: string | undefined): number {
  if (!priceId) return 0
  const pack = CREDIT_PACKS.find(p => packPriceId(p.key) === priceId)
  return pack?.credits ?? 0
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/studio && git commit -m "feat(studio): credit constants and generation stream parsing"
```

---

### Task 3: 생성 프롬프트 조립 (TDD)

**Files:**
- Create: `lib/studio/prompt.ts`
- Test: `lib/studio/prompt.test.ts`

**Interfaces:**
- Consumes: 없음 (독립 모듈)
- Produces:
  - `SYSTEM_PROMPT: string`
  - `ChatTurn = { role: 'user' | 'assistant'; content: string }`
  - `buildMessages(opts: { prompt: string; currentHtml: string | null; history: ChatTurn[] }): ChatTurn[]` — 마지막 원소는 항상 user, 역할 교대 보장, history 최근 6턴만

- [ ] **Step 1: 실패하는 테스트 작성** — `lib/studio/prompt.test.ts`

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMessages, SYSTEM_PROMPT } from './prompt'

test('첫 생성: 요청만 담긴 user 메시지 1개', () => {
  const msgs = buildMessages({ prompt: '점프 게임 만들어줘', currentHtml: null, history: [] })
  assert.equal(msgs.length, 1)
  assert.equal(msgs[0].role, 'user')
  assert.match(msgs[0].content, /점프 게임 만들어줘/)
  assert.doesNotMatch(msgs[0].content, /<game>/)
})

test('수정: 현재 HTML이 user 메시지에 포함된다', () => {
  const msgs = buildMessages({
    prompt: '배경을 파랗게', currentHtml: '<html>v1</html>',
    history: [
      { role: 'user', content: '점프 게임 만들어줘' },
      { role: 'assistant', content: '만들었어요' },
    ],
  })
  const last = msgs[msgs.length - 1]
  assert.equal(last.role, 'user')
  assert.match(last.content, /<game><html>v1<\/html><\/game>/)
  assert.match(last.content, /배경을 파랗게/)
})

test('역할 교대: 연속 같은 role은 병합, 선두 assistant 제거, 마지막은 user', () => {
  const msgs = buildMessages({
    prompt: '다음', currentHtml: null,
    history: [
      { role: 'assistant', content: '떠돌이 인사' },
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'c' },
    ],
  })
  assert.equal(msgs[0].role, 'user')
  for (let i = 1; i < msgs.length; i++) assert.notEqual(msgs[i].role, msgs[i - 1].role)
  assert.equal(msgs[msgs.length - 1].role, 'user')
})

test('history는 최근 6턴만 사용한다', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `m${i}`,
  }))
  const msgs = buildMessages({ prompt: '다음', currentHtml: null, history })
  assert.ok(msgs.length <= 7)
  assert.ok(!msgs.some(m => m.content === 'm0'))
})

test('시스템 프롬프트는 출력 형식과 외부 리소스 금지를 명시한다', () => {
  assert.match(SYSTEM_PROMPT, /<game>/)
  assert.match(SYSTEM_PROMPT, /외부 리소스/)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './prompt'`

- [ ] **Step 3: 구현** — `lib/studio/prompt.ts`

```ts
export const SYSTEM_PROMPT = `너는 Vibrax 스튜디오의 게임 제작 AI야. 사용자의 요청에 따라 완결된 단일 HTML5 게임을 만든다.

규칙:
- 출력 형식: 먼저 2~3문장의 짧은 한국어 설명(무엇을 만들었는지/바꿨는지), 그 다음 <game>완결된 HTML</game>
- HTML은 <!DOCTYPE html>부터 </html>까지 완결된 단일 파일이어야 한다.
- 외부 리소스(CDN 스크립트, 이미지 URL, 웹폰트) 금지 — 모든 코드/스타일은 인라인, 그래픽은 canvas 그리기나 이모지로 해결한다.
- <head>의 <title>에 짧은 게임 제목을 넣는다.
- canvas 기반 게임을 권장한다. 키보드 조작 기본 + 모바일 터치 지원.
- 게임은 검은 배경에 꽉 차게(body margin 0) 렌더링한다.
- 기존 게임 HTML이 주어지면 요청된 수정만 반영한 "전체 완성본"을 다시 출력한다.
- <game> 태그 밖에는 절대 코드를 쓰지 않는다.`

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export function buildMessages(opts: {
  prompt: string
  currentHtml: string | null
  history: ChatTurn[]
}): ChatTurn[] {
  // 최근 6턴만, 역할 교대 강제 (기존 app/api/user-agent/chat 패턴)
  const sanitized: ChatTurn[] = []
  for (const m of opts.history.slice(-6)) {
    if (!m.content?.trim()) continue
    const last = sanitized[sanitized.length - 1]
    if (!last || last.role !== m.role) sanitized.push({ role: m.role, content: m.content })
    else sanitized[sanitized.length - 1] = { role: m.role, content: m.content }
  }
  while (sanitized.length > 0 && sanitized[0].role === 'assistant') sanitized.shift()
  // 새 user 메시지가 뒤에 붙으므로 history 끝의 user는 제거해 교대를 유지
  if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === 'user') sanitized.pop()

  const parts: string[] = []
  if (opts.currentHtml) parts.push(`현재 게임 HTML:\n<game>${opts.currentHtml}</game>`)
  parts.push(`요청: ${opts.prompt}`)
  return [...sanitized, { role: 'user', content: parts.join('\n\n') }]
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (12 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/studio/prompt.ts lib/studio/prompt.test.ts
git commit -m "feat(studio): generation system prompt and message assembly"
```

---

### Task 4: admin 클라이언트 + 생성 API

**Files:**
- Create: `lib/supabase/admin.ts`
- Create: `app/api/studio/generate/route.ts`

**Interfaces:**
- Consumes: `spend_credits`/`refund_credits` RPC (Task 1), `GENERATION_COST` (Task 2), `parseGeneration`/`extractTitle`/`GEN_ERROR_MARKER` (Task 2), `SYSTEM_PROMPT`/`buildMessages` (Task 3)
- Produces:
  - `createAdminClient(): SupabaseClient` — service role, 서버 전용
  - `POST /api/studio/generate` body `{ projectId: string, prompt: string }` → text/plain 스트림. 상태코드: 400/401/402(크레딧 부족)/404/500. 실패 시 스트림 끝에 `GEN_ERROR_MARKER` 추가

- [ ] **Step 1: admin 클라이언트** — `lib/supabase/admin.ts`

```ts
// 서버 전용(service role). 웹훅 크레딧 지급과 /play 공개 서빙에만 사용한다.
// 클라이언트 번들에 포함되면 안 됨 — 'use client' 파일에서 import 금지.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
```

- [ ] **Step 2: 환경변수 추가** — `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY=` (Supabase 대시보드 → Settings → API → service_role). 사용자에게 값 입력을 요청하고 완료 확인 후 진행.

- [ ] **Step 3: 생성 라우트** — `app/api/studio/generate/route.ts`

```ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { GENERATION_COST } from '@/lib/studio/constants'
import { SYSTEM_PROMPT, buildMessages, type ChatTurn } from '@/lib/studio/prompt'
import { parseGeneration, extractTitle, GEN_ERROR_MARKER } from '@/lib/studio/parse'

export const maxDuration = 300

export async function POST(req: Request) {
  const { projectId, prompt } = await req.json()
  if (!projectId || !prompt?.trim()) return new Response('bad request', { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('unauthorized', { status: 401 })

  // RLS로 본인 프로젝트만 조회됨 — 없으면 404
  const { data: project } = await supabase
    .from('studio_projects').select('id, title').eq('id', projectId).maybeSingle()
  if (!project) return new Response('not found', { status: 404 })

  // 크레딧 원자적 차감 — 실패 경로에서 이 ref로 환불
  const spendRef = `gen:${projectId}:${crypto.randomUUID()}`
  const { error: spendError } = await supabase.rpc('spend_credits', {
    p_amount: GENERATION_COST,
    p_ref: spendRef,
  } as never)
  if (spendError) {
    const insufficient = spendError.message.includes('INSUFFICIENT_CREDITS')
    return new Response(insufficient ? 'insufficient credits' : 'spend failed', {
      status: insufficient ? 402 : 500,
    })
  }

  const [latestRes, historyRes] = await Promise.all([
    supabase.from('studio_versions').select('html, version')
      .eq('project_id', projectId).order('version', { ascending: false })
      .limit(1).maybeSingle(),
    supabase.from('studio_messages').select('role, content')
      .eq('project_id', projectId).order('created_at', { ascending: true }),
  ])
  const latest = latestRes.data as { html: string; version: number } | null
  const history = (historyRes.data ?? []) as ChatTurn[]

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    messages: buildMessages({ prompt, currentHtml: latest?.html ?? null, history }),
  })

  const refund = () =>
    supabase.rpc('refund_credits', { p_amount: GENERATION_COST, p_ref: spendRef } as never)

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let full = ''
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            full += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        const parsed = parseGeneration(full)
        if (!parsed.html) {
          await refund()
          controller.enqueue(encoder.encode(GEN_ERROR_MARKER))
        } else {
          const nextVersion = (latest?.version ?? 0) + 1
          const { error: vErr } = await supabase.from('studio_versions').insert([
            { project_id: projectId, version: nextVersion, html: parsed.html },
          ] as never)
          if (vErr) {
            await refund()
            controller.enqueue(encoder.encode(GEN_ERROR_MARKER))
          } else {
            await supabase.from('studio_messages').insert([
              { project_id: projectId, role: 'user', content: prompt },
              { project_id: projectId, role: 'assistant', content: parsed.description },
            ] as never)
            if (nextVersion === 1) {
              const title = extractTitle(parsed.html)
              if (title) {
                await supabase.from('studio_projects')
                  .update({ title } as never).eq('id', projectId)
              }
            }
          }
        }
      } catch {
        await refund()
        controller.enqueue(encoder.encode(GEN_ERROR_MARKER))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 4: 수동 검증**

`npm run dev` 실행 후 로그인 상태의 브라우저 콘솔에서:

```js
// 1) 프로젝트 생성 후 id 확보 (아직 UI가 없으므로 콘솔에서)
// supabase-js가 노출되어 있지 않으므로 fetch로 확인은 Task 6 이후 UI에서 해도 됨.
// 여기서는 미로그인 401만 확인:
fetch('/api/studio/generate', { method: 'POST', body: JSON.stringify({ projectId: 'x', prompt: 'y' }), headers: { 'Content-Type': 'application/json' } }).then(r => console.log(r.status))
```
Expected: 로그아웃 상태에서 `401`. 전체 스트림 검증은 Task 7 후 E2E로 수행.

- [ ] **Step 5: 린트 + 커밋**

```bash
npm run lint && git add lib/supabase/admin.ts app/api/studio/generate/route.ts
git commit -m "feat(studio): generation API with credit spend/refund and streaming"
```

---

### Task 5: i18n 문자열 + NavBar 스튜디오 링크

**Files:**
- Modify: `lib/i18n/translations.ts`
- Modify: `components/NavBar.tsx`

**Interfaces:**
- Produces: `T.nav.studio`, `T.studio.*`, `T.credits.*` (아래 키 전부, ko/en 동일 구조 — 이후 태스크의 UI가 이 키를 사용)

- [ ] **Step 1: translations.ts에 추가** — `ko.nav`에 `studio: 'STUDIO'`, `en.nav`에 `studio: 'STUDIO'`. `ko` 객체에 (submit 섹션 다음):

```ts
    studio: {
      heading: 'STUDIO',
      subtitle: '프롬프트로 게임을 만들고 바로 실행해보세요',
      newProject: '+ 새 게임 만들기',
      empty: '아직 만든 게임이 없습니다. 첫 게임을 만들어보세요!',
      untitled: '새 게임',
      openProject: '열기 →',
      balance: (n: number) => `${n} 크레딧`,
      costNote: '생성 1회 = 10크레딧',
      chatPlaceholder: '만들고 싶은 게임이나 수정할 내용을 설명해 주세요...',
      send: '전송',
      emptyPreview: '만들고 싶은 게임을 설명해 주세요',
      emptyPreviewDesc: '예: "화살표로 조작하는 벽돌깨기 게임 만들어줘"',
      writingCode: (kb: string) => `코드 작성 중... ${kb}KB`,
      thinking: '생각 중...',
      refresh: '⟳ 새로고침',
      versions: '버전',
      versionLabel: (v: number) => `v${v}`,
      publish: '게시하기',
      insufficient: '크레딧이 부족합니다.',
      goCharge: '충전하러 가기 →',
      genError: '생성에 실패했어요. 크레딧은 환불되었습니다. 다시 시도해 주세요.',
      publishHeading: 'PUBLISH GAME',
      publishDesc: '게임 목록에 공개됩니다.',
      publishDone: '게시 완료! 게임 목록에서 확인하세요.',
      publishBtn: 'PUBLISH',
      publishing: 'PUBLISHING...',
      cancel: '취소',
      alreadyPublished: '이미 게시된 게임입니다. 새 버전이 자동 반영됩니다.',
      loading: 'LOADING...',
      backToStudio: '← 스튜디오',
    },
    credits: {
      heading: 'CREDITS',
      subtitle: '크레딧을 충전하고 게임을 만들어보세요',
      balance: '보유 크레딧',
      buy: '충전하기',
      packCredits: (n: number) => `${n} 크레딧`,
      note: '결제는 Paddle을 통해 안전하게 처리됩니다. 결제 완료 후 크레딧이 자동 지급됩니다.',
      processing: '결제 확인 중...',
      done: '충전이 완료되었습니다!',
    },
```

`en` 객체에 같은 키로:

```ts
    studio: {
      heading: 'STUDIO',
      subtitle: 'Build a game from a prompt and play it instantly',
      newProject: '+ NEW GAME',
      empty: 'No games yet. Create your first one!',
      untitled: 'Untitled Game',
      openProject: 'OPEN →',
      balance: (n: number) => `${n} credits`,
      costNote: '1 generation = 10 credits',
      chatPlaceholder: 'Describe the game you want to build or change...',
      send: 'SEND',
      emptyPreview: 'Describe the game you want to make',
      emptyPreviewDesc: 'e.g. "Make a brick-breaker game with arrow keys"',
      writingCode: (kb: string) => `Writing code... ${kb}KB`,
      thinking: 'Thinking...',
      refresh: '⟳ REFRESH',
      versions: 'VERSIONS',
      versionLabel: (v: number) => `v${v}`,
      publish: 'PUBLISH',
      insufficient: 'Not enough credits.',
      goCharge: 'Get credits →',
      genError: 'Generation failed. Your credits were refunded — please try again.',
      publishHeading: 'PUBLISH GAME',
      publishDesc: 'Your game will appear in the public game list.',
      publishDone: 'Published! Check the games list.',
      publishBtn: 'PUBLISH',
      publishing: 'PUBLISHING...',
      cancel: 'CANCEL',
      alreadyPublished: 'Already published. New versions go live automatically.',
      loading: 'LOADING...',
      backToStudio: '← STUDIO',
    },
    credits: {
      heading: 'CREDITS',
      subtitle: 'Top up credits to build games',
      balance: 'YOUR CREDITS',
      buy: 'BUY',
      packCredits: (n: number) => `${n} credits`,
      note: 'Payments are securely processed by Paddle. Credits are granted automatically after checkout.',
      processing: 'Confirming payment...',
      done: 'Credits added!',
    },
```

- [ ] **Step 2: NavBar 링크 추가** — `components/NavBar.tsx`
  - 데스크톱(117행 부근): `{navLinkDesktop('/games', T.nav.games)}` 다음 줄에 `{navLinkDesktop('/studio', T.nav.studio)}` 추가
  - 모바일(207행 부근): `{navLinkMobile('/games', T.nav.games)}` 다음 줄에 `{navLinkMobile('/studio', T.nav.studio)}` 추가
  - (스튜디오는 로그인 없이 클릭 가능 — 페이지에서 로그인으로 리다이렉트)

- [ ] **Step 3: 확인 + 커밋**

Run: `npm run lint && npm run build`
Expected: 에러 없음. `npm run dev`에서 네비게이션에 STUDIO 표시, KO/EN 전환 정상.

```bash
git add lib/i18n/translations.ts components/NavBar.tsx
git commit -m "feat(studio): nav menu and i18n strings for studio/credits"
```

---

### Task 6: /studio 프로젝트 목록 페이지

**Files:**
- Create: `app/studio/page.tsx`

**Interfaces:**
- Consumes: `grant_signup_bonus` RPC (Task 1), `StudioProject` 타입 (Task 1), `T.studio.*` (Task 5)
- Produces: `/studio` 라우트 — 첫 진입 시 보너스 지급, 프로젝트 생성 → `/studio/[id]` 이동

- [ ] **Step 1: 페이지 구현** — `app/studio/page.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { StudioProject } from '@/lib/supabase/types'

export default function StudioPage() {
  const [projects, setProjects] = useState<StudioProject[] | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { T } = useLang()
  const s = T.studio

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/login?redirect=/studio')
        return
      }
      // 첫 진입 보너스(멱등) — 반환값이 현재 잔액
      const { data: bal } = await supabase.rpc('grant_signup_bonus' as never)
      setBalance(typeof bal === 'number' ? bal : 0)
      const { data } = await supabase
        .from('studio_projects')
        .select('*')
        .order('created_at', { ascending: false })
      setProjects((data as StudioProject[] | null) ?? [])
    })
  }, [])

  const createProject = async () => {
    if (creating) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('studio_projects')
      .insert([{ user_id: user.id }] as never)
      .select()
      .single()
    if (!error && data) router.push(`/studio/${(data as StudioProject).id}`)
    else setCreating(false)
  }

  if (projects === null) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{s.loading}</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-2 flex-wrap gap-3">
        <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest">{s.heading}</h1>
        <div className="flex items-center gap-4">
          <span className="font-pixel text-[10px] text-gray-400 tracking-widest">
            {s.balance(balance ?? 0)}
          </span>
          <Link
            href="/credits"
            className="font-pixel text-[10px] tracking-widest text-[#00ff41] border border-[#00ff41] px-3 py-1.5 hover:bg-[#00ff41] hover:text-black transition-colors"
          >
            {T.credits.heading}
          </Link>
        </div>
      </div>
      <p className="text-gray-300 text-sm mb-8">{s.subtitle}</p>

      <button
        onClick={createProject}
        disabled={creating}
        className="mb-10 bg-[#00ff41] text-black font-pixel text-[11px] px-6 py-4 hover:bg-[#00cc33] transition-colors disabled:opacity-50 tracking-widest"
      >
        {s.newProject}
      </button>

      {projects.length === 0 ? (
        <p className="text-gray-500 text-sm">{s.empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <Link
              key={p.id}
              href={`/studio/${p.id}`}
              className="border border-gray-800 bg-[#111] p-5 hover:border-[#00ff41] transition-colors group"
            >
              <h2 className="text-white text-sm mb-2 truncate">{p.title || s.untitled}</h2>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-600">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
                <span className="font-pixel text-[10px] text-gray-500 group-hover:text-[#00ff41] tracking-widest transition-colors">
                  {s.openProject}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 수동 확인**

`npm run dev` → 로그인 → `/studio` 진입.
Expected: 잔액 `30 크레딧`(보너스), 새로고침해도 30 유지(멱등). "새 게임 만들기" → `/studio/<uuid>`로 이동(다음 태스크 전까지 404 — 정상).

- [ ] **Step 3: 린트 + 커밋**

```bash
npm run lint && git add app/studio/page.tsx
git commit -m "feat(studio): project list page with signup bonus and balance"
```

---

### Task 7: 제작 화면 (/studio/[id]) — 채팅 + 프리뷰

**Files:**
- Create: `components/studio/StudioChat.tsx`
- Create: `components/studio/GamePreview.tsx`
- Create: `app/studio/[id]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/studio/generate` (Task 4), `parseGeneration`/`hasGenError` (Task 2), `T.studio.*` (Task 5), `StudioMessage`/`StudioVersionMeta` 타입 (Task 1)
- Produces:
  - `StudioChat` props: `{ messages: { role: 'user'|'assistant'; content: string }[]; streaming: { description: string; htmlBytes: number } | null; error: string | null; onSend: (prompt: string) => void; busy: boolean }`
  - `GamePreview` props: `{ html: string | null; versions: StudioVersionMeta[]; currentVersionId: string | null; onSelectVersion: (id: string) => void; onPublish: () => void; busy: boolean }`
  - 게시 버튼 콜백은 Task 10의 `PublishModal`이 연결됨 (이 태스크에서는 자리만)

- [ ] **Step 1: StudioChat** — `components/studio/StudioChat.tsx`

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/i18n/context'

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

export default function StudioChat({
  messages, streaming, error, onSend, busy,
}: {
  messages: ChatMsg[]
  streaming: { description: string; htmlBytes: number } | null
  error: string | null
  onSend: (prompt: string) => void
  busy: boolean
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const { T } = useLang()
  const s = T.studio

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streaming?.description, streaming?.htmlBytes])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const p = input.trim()
    if (!p || busy) return
    setInput('')
    onSend(p)
  }

  return (
    <div className="flex flex-col h-full border-r border-gray-800">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="text-gray-500 text-sm pt-8 text-center">
            <p className="mb-2">{s.emptyPreview}</p>
            <p className="text-[11px] text-gray-600">{s.emptyPreviewDesc}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[#00ff41]/10 border border-[#00ff41]/40 text-white'
                  : 'bg-[#161616] border border-gray-800 text-gray-200'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-2 text-sm bg-[#161616] border border-gray-800 text-gray-200 whitespace-pre-wrap">
              {streaming.description || s.thinking}
              {streaming.htmlBytes > 0 && (
                <p className="font-pixel text-[10px] text-[#00ff41] mt-2 tracking-widest animate-pulse">
                  {s.writingCode((streaming.htmlBytes / 1024).toFixed(1))}
                </p>
              )}
            </div>
          </div>
        )}
        {error && (
          <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="border-t border-gray-800 p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit(e)
              }
            }}
            rows={2}
            placeholder={s.chatPlaceholder}
            className="flex-1 bg-[#111] border border-gray-800 focus:border-[#00ff41] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors resize-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="bg-[#00ff41] text-black font-pixel text-[10px] px-4 hover:bg-[#00cc33] transition-colors disabled:opacity-40 tracking-widest"
          >
            {s.send}
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-2">{s.costNote}</p>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: GamePreview** — `components/studio/GamePreview.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n/context'
import type { StudioVersionMeta } from '@/lib/supabase/types'

export default function GamePreview({
  html, versions, currentVersionId, onSelectVersion, onPublish, busy,
}: {
  html: string | null
  versions: StudioVersionMeta[]
  currentVersionId: string | null
  onSelectVersion: (id: string) => void
  onPublish: () => void
  busy: boolean
}) {
  const [frameKey, setFrameKey] = useState(0)
  const { T } = useLang()
  const s = T.studio

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2 flex-wrap">
        <button
          onClick={() => setFrameKey(k => k + 1)}
          disabled={!html}
          className="font-pixel text-[10px] text-gray-400 hover:text-[#00ff41] transition-colors disabled:opacity-40 tracking-widest"
        >
          {s.refresh}
        </button>
        {versions.length > 0 && (
          <select
            value={currentVersionId ?? ''}
            onChange={e => onSelectVersion(e.target.value)}
            className="bg-[#111] border border-gray-800 text-gray-300 text-[11px] px-2 py-1 outline-none"
            aria-label={s.versions}
          >
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                {s.versionLabel(v.version)} — {new Date(v.created_at).toLocaleString()}
              </option>
            ))}
          </select>
        )}
        <div className="flex-1" />
        <button
          onClick={onPublish}
          disabled={!html || busy}
          className="bg-[#00ff41] text-black font-pixel text-[10px] px-4 py-1.5 hover:bg-[#00cc33] transition-colors disabled:opacity-40 tracking-widest"
        >
          {s.publish}
        </button>
      </div>
      <div className="flex-1 bg-black">
        {html ? (
          <iframe
            key={frameKey}
            sandbox="allow-scripts allow-pointer-lock"
            srcDoc={html}
            className="w-full h-full border-0"
            title="game preview"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="font-pixel text-[10px] text-gray-700 tracking-widest">{s.emptyPreview}</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 페이지 오케스트레이션** — `app/studio/[id]/page.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import StudioChat, { type ChatMsg } from '@/components/studio/StudioChat'
import GamePreview from '@/components/studio/GamePreview'
import { parseGeneration, hasGenError } from '@/lib/studio/parse'
import type { StudioProject, StudioVersionMeta } from '@/lib/supabase/types'

export default function StudioComposerPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { T } = useLang()
  const s = T.studio

  const [project, setProject] = useState<StudioProject | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [versions, setVersions] = useState<StudioVersionMeta[]>([])
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [streaming, setStreaming] = useState<{ description: string; htmlBytes: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPublish, setShowPublish] = useState(false)

  const refreshBalance = async () => {
    const { data } = await supabase.rpc('credit_balance' as never)
    setBalance(typeof data === 'number' ? data : 0)
  }

  const refreshVersions = async () => {
    const { data } = await supabase
      .from('studio_versions')
      .select('id, version, created_at')
      .eq('project_id', id)
      .order('version', { ascending: false })
    const list = (data as StudioVersionMeta[] | null) ?? []
    setVersions(list)
    return list
  }

  const loadVersionHtml = async (versionId: string) => {
    const { data } = await supabase
      .from('studio_versions')
      .select('html')
      .eq('id', versionId)
      .single()
    if (data) {
      setHtml((data as { html: string }).html)
      setCurrentVersionId(versionId)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push(`/login?redirect=/studio/${id}`)
        return
      }
      const { data: proj } = await supabase
        .from('studio_projects').select('*').eq('id', id).maybeSingle()
      if (!proj) {
        router.push('/studio')
        return
      }
      setProject(proj as StudioProject)
      const { data: msgs } = await supabase
        .from('studio_messages')
        .select('role, content')
        .eq('project_id', id)
        .order('created_at', { ascending: true })
      setMessages((msgs as ChatMsg[] | null) ?? [])
      const list = await refreshVersions()
      if (list.length > 0) await loadVersionHtml(list[0].id)
      await refreshBalance()
    })
  }, [id])

  const send = async (prompt: string) => {
    setError(null)
    setMessages(m => [...m, { role: 'user', content: prompt }])
    setStreaming({ description: '', htmlBytes: 0 })

    const res = await fetch('/api/studio/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: id, prompt }),
    })

    if (res.status === 402) {
      setStreaming(null)
      setMessages(m => m.slice(0, -1))
      setError(s.insufficient)
      return
    }
    if (!res.ok || !res.body) {
      setStreaming(null)
      setMessages(m => m.slice(0, -1))
      setError(s.genError)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      full += decoder.decode(value, { stream: true })
      const p = parseGeneration(full)
      setStreaming({ description: p.description, htmlBytes: p.htmlBytes })
    }
    setStreaming(null)

    if (hasGenError(full)) {
      setError(s.genError)
      await refreshBalance()
      return
    }

    const parsed = parseGeneration(full)
    setMessages(m => [...m, { role: 'assistant', content: parsed.description }])
    if (parsed.html) setHtml(parsed.html)
    const list = await refreshVersions()
    if (list.length > 0) setCurrentVersionId(list[0].id)
    await refreshBalance()
    // 첫 생성이면 서버가 제목을 갱신했을 수 있음
    const { data: proj } = await supabase
      .from('studio_projects').select('*').eq('id', id).maybeSingle()
    if (proj) setProject(proj as StudioProject)
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{s.loading}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div className="flex items-center gap-4 border-b border-gray-800 px-4 py-2 shrink-0">
        <Link
          href="/studio"
          className="font-pixel text-[10px] text-gray-400 hover:text-[#00ff41] tracking-widest transition-colors shrink-0"
        >
          {s.backToStudio}
        </Link>
        <h1 className="text-white text-sm truncate">{project.title}</h1>
        <div className="flex-1" />
        <Link
          href="/credits"
          className="font-pixel text-[10px] text-[#00ff41] tracking-widest shrink-0 hover:underline"
        >
          {s.balance(balance ?? 0)}
        </Link>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[2fr_3fr] min-h-0">
        <StudioChat
          messages={messages}
          streaming={streaming}
          error={error}
          onSend={send}
          busy={streaming !== null}
        />
        <GamePreview
          html={html}
          versions={versions}
          currentVersionId={currentVersionId}
          onSelectVersion={loadVersionHtml}
          onPublish={() => setShowPublish(true)}
          busy={streaming !== null}
        />
      </div>
      {/* PublishModal은 Task 10에서 연결 */}
      {showPublish && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center" onClick={() => setShowPublish(false)}>
          <p className="text-gray-400 text-sm">publish: coming in Task 10</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: E2E 수동 검증 (핵심 흐름)**

`npm run dev` → `/studio` → 새 게임 만들기 → 채팅에 "화살표로 조작하는 벽돌깨기 게임 만들어줘" 전송.
Expected:
1. 채팅에 내 메시지 표시, 어시스턴트 말풍선에 설명 스트리밍 → "코드 작성 중... NKB" 진행 표시
2. 완료 후 오른쪽 iframe에 게임 렌더링, 조작 가능
3. 잔액 30 → 20으로 감소, 헤더 제목이 AI가 지은 제목으로 갱신
4. "배경을 우주 느낌으로 바꿔줘" 전송 → v2 생성, 버전 드롭다운에 v1/v2, v1 선택 시 이전 게임 표시
5. 새로고침 후 재진입 → 대화/최신 게임 복원

- [ ] **Step 5: 린트 + 커밋**

```bash
npm run lint && git add components/studio app/studio
git commit -m "feat(studio): composer screen with streaming chat and sandboxed preview"
```

---

### Task 8: Paddle 웹훅 서명 검증 (TDD) + 웹훅 라우트

**Files:**
- Create: `lib/paddle/verify.ts`
- Test: `lib/paddle/verify.test.ts`
- Create: `app/api/webhooks/paddle/route.ts`

**Interfaces:**
- Consumes: `createAdminClient` (Task 4), `creditsForPriceId` (Task 2)
- Produces:
  - `parsePaddleSignature(header: string): { ts: string; h1: string } | null`
  - `verifyPaddleSignature(rawBody: string, header: string, secret: string): boolean`
  - `POST /api/webhooks/paddle` — 서명 불일치 401, 그 외 200 (Paddle 재시도 규약)

- [ ] **Step 1: 실패하는 테스트 작성** — `lib/paddle/verify.test.ts`

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { parsePaddleSignature, verifyPaddleSignature } from './verify'

const SECRET = 'whsec_test'
const sign = (ts: string, body: string) =>
  createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex')

test('올바른 서명은 통과한다', () => {
  const body = '{"event_type":"transaction.completed"}'
  const header = `ts=1700000000;h1=${sign('1700000000', body)}`
  assert.equal(verifyPaddleSignature(body, header, SECRET), true)
})

test('본문이 변조되면 실패한다', () => {
  const header = `ts=1700000000;h1=${sign('1700000000', '{"a":1}')}`
  assert.equal(verifyPaddleSignature('{"a":2}', header, SECRET), false)
})

test('시크릿이 다르면 실패한다', () => {
  const body = '{}'
  const header = `ts=1;h1=${sign('1', body)}`
  assert.equal(verifyPaddleSignature(body, header, 'other'), false)
})

test('형식이 잘못된 헤더/빈 시크릿은 실패한다', () => {
  assert.equal(parsePaddleSignature('garbage'), null)
  assert.equal(verifyPaddleSignature('{}', 'garbage', SECRET), false)
  assert.equal(verifyPaddleSignature('{}', 'ts=1;h1=ab', ''), false)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './verify'`

- [ ] **Step 3: 구현** — `lib/paddle/verify.ts`

```ts
// Paddle 웹훅 서명 검증 — 헤더 형식 "ts=<unix>;h1=<hex>",
// 서명 대상은 "<ts>:<rawBody>" (HMAC-SHA256, 웹훅 시크릿)
import { createHmac, timingSafeEqual } from 'node:crypto'

export function parsePaddleSignature(header: string): { ts: string; h1: string } | null {
  const parts: Record<string, string> = {}
  for (const kv of header.split(';')) {
    const idx = kv.indexOf('=')
    if (idx === -1) continue
    parts[kv.slice(0, idx)] = kv.slice(idx + 1)
  }
  if (!parts.ts || !parts.h1) return null
  return { ts: parts.ts, h1: parts.h1 }
}

export function verifyPaddleSignature(rawBody: string, header: string, secret: string): boolean {
  if (!secret) return false
  const parsed = parsePaddleSignature(header)
  if (!parsed) return false
  const expected = createHmac('sha256', secret).update(`${parsed.ts}:${rawBody}`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(parsed.h1)
  return a.length === b.length && timingSafeEqual(a, b)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (16 tests)

- [ ] **Step 5: 웹훅 라우트** — `app/api/webhooks/paddle/route.ts`

```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPaddleSignature } from '@/lib/paddle/verify'
import { creditsForPriceId } from '@/lib/studio/constants'

export async function POST(req: Request) {
  const raw = await req.text()
  const sig = req.headers.get('paddle-signature') ?? ''
  if (!verifyPaddleSignature(raw, sig, process.env.PADDLE_WEBHOOK_SECRET ?? '')) {
    return new Response('invalid signature', { status: 401 })
  }

  const event = JSON.parse(raw)
  if (event.event_type !== 'transaction.completed') {
    return new Response('ignored', { status: 200 })
  }

  const userId: string | undefined = event.data?.custom_data?.user_id
  const txId: string | undefined = event.data?.id
  let credits = 0
  for (const item of event.data?.items ?? []) {
    credits += creditsForPriceId(item.price?.id) * (item.quantity ?? 1)
  }
  if (!userId || !txId || credits <= 0) {
    // 매핑 불가 이벤트 — 재시도해도 결과가 같으므로 200
    return new Response('ignored', { status: 200 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('credit_ledger').insert([
    { user_id: userId, amount: credits, reason: 'purchase', ref_id: txId },
  ] as never)
  // unique 위반 = 이미 지급(중복 웹훅) → 정상 처리
  if (error && !error.message.toLowerCase().includes('duplicate')) {
    return new Response('error', { status: 500 })
  }
  return new Response('ok', { status: 200 })
}
```

- [ ] **Step 6: 수동 검증 (로컬 curl)**

`.env.local`에 `PADDLE_WEBHOOK_SECRET=whsec_local_test` 추가 후 `npm run dev`. 서명은 node로 계산:

```bash
BODY='{"event_type":"transaction.completed","data":{"id":"txn_test_1","custom_data":{"user_id":"<내 profiles.id>"},"items":[{"quantity":1,"price":{"id":"pri_test_small"}}]}}'
TS=1700000000
H1=$(node -e "const c=require('crypto');console.log(c.createHmac('sha256','whsec_local_test').update('$TS:'+process.argv[1]).digest('hex'))" "$BODY")
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/webhooks/paddle \
  -H "Content-Type: application/json" -H "paddle-signature: ts=$TS;h1=$H1" -d "$BODY"
```

Expected: `NEXT_PUBLIC_PADDLE_PRICE_SMALL=pri_test_small`이 설정돼 있으면 `200` + `credit_ledger`에 +100 1건. 같은 명령 재실행 → `200`이지만 지급은 1건 유지(중복 차단). 서명 헤더를 지우면 `401`.

- [ ] **Step 7: 린트 + 커밋**

```bash
npm run lint && git add lib/paddle app/api/webhooks
git commit -m "feat(credits): paddle webhook with signature verification and dedup grant"
```

---

### Task 9: /credits 충전 페이지 (Paddle Overlay)

**Files:**
- Create: `app/credits/page.tsx`
- Modify: `package.json` (`@paddle/paddle-js` 추가)

**Interfaces:**
- Consumes: `CREDIT_PACKS`/`packPriceId` (Task 2), `credit_balance` RPC (Task 1), `T.credits.*` (Task 5)
- Produces: `/credits` 라우트 — Paddle Checkout 열기, `custom_data.user_id` 전달, 완료 후 잔액 폴링

- [ ] **Step 1: 의존성 설치**

```bash
npm install @paddle/paddle-js
```

- [ ] **Step 2: 페이지 구현** — `app/credits/page.tsx`

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import { CREDIT_PACKS, packPriceId } from '@/lib/studio/constants'

export default function CreditsPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle')
  const paddleRef = useRef<Paddle | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { T } = useLang()
  const c = T.credits

  const refreshBalance = async () => {
    const { data } = await supabase.rpc('credit_balance' as never)
    const n = typeof data === 'number' ? data : 0
    setBalance(n)
    return n
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/login?redirect=/credits')
        return
      }
      setUserId(user.id)
      await refreshBalance()
    })

    initializePaddle({
      environment:
        process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!,
      eventCallback: event => {
        if (event.name === 'checkout.completed') {
          setStatus('processing')
          // 웹훅 지급이 반영될 때까지 짧게 폴링
          const before = balanceRef.current ?? 0
          let tries = 0
          const timer = setInterval(async () => {
            tries += 1
            const now = await refreshBalance()
            if (now > before || tries >= 10) {
              clearInterval(timer)
              setStatus(now > before ? 'done' : 'idle')
            }
          }, 2000)
        }
      },
    }).then(p => {
      if (p) paddleRef.current = p
    })
  }, [])

  // eventCallback 클로저에서 최신 잔액을 읽기 위한 ref
  const balanceRef = useRef<number | null>(null)
  useEffect(() => { balanceRef.current = balance }, [balance])

  const buy = (key: 'small' | 'medium' | 'large') => {
    const priceId = packPriceId(key)
    if (!priceId || !paddleRef.current || !userId) return
    paddleRef.current.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: { user_id: userId },
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-2">{c.heading}</h1>
      <p className="text-gray-300 text-sm mb-8">{c.subtitle}</p>

      <div className="border border-gray-800 bg-[#111] px-5 py-4 mb-10 flex items-center justify-between">
        <span className="font-pixel text-[10px] text-gray-400 tracking-widest">{c.balance}</span>
        <span className="font-pixel text-[#00ff41] text-lg tracking-widest">{balance ?? '—'}</span>
      </div>

      {status === 'processing' && (
        <p className="mb-6 text-[#00ff41] text-xs font-pixel tracking-widest animate-pulse">
          {c.processing}
        </p>
      )}
      {status === 'done' && (
        <p className="mb-6 text-[#00ff41] text-xs font-pixel tracking-widest">{c.done}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {CREDIT_PACKS.map(p => (
          <div key={p.key} className="border border-gray-800 bg-[#111] p-6 flex flex-col items-center gap-4 hover:border-[#00ff41] transition-colors">
            <span className="font-pixel text-white text-base tracking-widest">${p.usd}</span>
            <span className="text-[#00ff41] text-sm">{c.packCredits(p.credits)}</span>
            <button
              onClick={() => buy(p.key)}
              className="w-full bg-[#00ff41] text-black font-pixel text-[10px] py-3 hover:bg-[#00cc33] transition-colors tracking-widest"
            >
              {c.buy}
            </button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-500">{c.note}</p>
    </div>
  )
}
```

주의: `balanceRef` 선언이 `useEffect`(initializePaddle)보다 아래에 있으면 TDZ 오류가 난다 — 실제 파일에서는 `balanceRef` 선언과 동기화 `useEffect`를 initializePaddle `useEffect`보다 **위에** 배치한다.

- [ ] **Step 3: Paddle Sandbox 설정 (사용자 작업)**

사용자에게 요청: Paddle Sandbox 계정에서 ① Product "Vibrax Credits" + Price 3개($5/$20/$50) 생성 → price id 3개, ② Developer Tools → Authentication에서 client-side token, ③ Notifications → Webhook endpoint 등록(`https://<터널 URL>/api/webhooks/paddle`, 이벤트: transaction.completed) → webhook secret. `.env.local`에:

```
NEXT_PUBLIC_PADDLE_ENV=sandbox
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_...
NEXT_PUBLIC_PADDLE_PRICE_SMALL=pri_...
NEXT_PUBLIC_PADDLE_PRICE_MEDIUM=pri_...
NEXT_PUBLIC_PADDLE_PRICE_LARGE=pri_...
PADDLE_WEBHOOK_SECRET=pdl_ntf_...
```

- [ ] **Step 4: 수동 검증**

`/credits` → $5 팩 "충전하기" → Paddle Sandbox 체크아웃(테스트 카드 4242 4242 4242 4242) 결제.
Expected: "결제 확인 중..." → 잔액 +100 반영 → "충전이 완료되었습니다!". (웹훅이 로컬에 도달하려면 터널 필요 — 없으면 Task 8 Step 6의 curl로 지급 경로만 검증하고 체크아웃 UI 동작만 확인)

- [ ] **Step 5: 린트 + 커밋**

```bash
npm run lint && git add app/credits/page.tsx package.json package-lock.json
git commit -m "feat(credits): credit packs page with Paddle overlay checkout"
```

---

### Task 10: 게시 흐름 (PublishModal + /play/[id])

**Files:**
- Create: `components/studio/PublishModal.tsx`
- Create: `app/play/[id]/route.ts`
- Modify: `app/studio/[id]/page.tsx` (Task 7의 자리표시 모달 교체)

**Interfaces:**
- Consumes: `createAdminClient` (Task 4), `Genre` 타입, `T.studio.*` (Task 5)
- Produces:
  - `PublishModal` props: `{ projectId: string; defaultTitle: string; onClose: () => void }`
  - `GET /play/[id]` — `id`는 studio_projects.id. 게시된 프로젝트의 최신 버전 HTML을 CSP sandbox 헤더로 서빙, 미게시/미존재 404

- [ ] **Step 1: PublishModal** — `components/studio/PublishModal.tsx`

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Genre } from '@/lib/supabase/types'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

export default function PublishModal({
  projectId, defaultTitle, onClose,
}: {
  projectId: string
  defaultTitle: string
  onClose: () => void
}) {
  const [title, setTitle] = useState(defaultTitle)
  const [genre, setGenre] = useState<Genre>('action')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [alreadyPublished, setAlreadyPublished] = useState(false)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const { T } = useLang()
  const s = T.studio

  useEffect(() => {
    supabase.from('games').select('id').eq('studio_project_id', projectId)
      .limit(1).maybeSingle()
      .then(({ data }) => setAlreadyPublished(!!data))
  }, [projectId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!thumbnailFile) {
      setError(T.submit.thumbnailRequired)
      return
    }
    setError(null)
    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext = thumbnailFile.name.split('.').pop() ?? 'png'
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('thumbnails').upload(path, thumbnailFile, { upsert: false })
      if (uploadError) {
        setError(uploadError.message)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(path)
      const { error: insertError } = await supabase.from('games').insert([
        {
          title,
          genre,
          play_url: `${window.location.origin}/play/${projectId}`,
          thumbnail_url: publicUrl,
          user_id: user.id,
          studio_project_id: projectId,
        },
      ] as never)
      if (insertError) {
        setError(insertError.message)
        return
      }
      setDone(true)
    })
  }

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-500'

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111] border border-gray-800 p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-pixel text-[#00ff41] text-xs tracking-widest mb-1">
          {s.publishHeading}
        </h2>
        <p className="text-gray-400 text-xs mb-5">{s.publishDesc}</p>

        {alreadyPublished ? (
          <p className="text-gray-300 text-sm mb-4">{s.alreadyPublished}</p>
        ) : done ? (
          <p className="text-[#00ff41] text-sm mb-4">{s.publishDone}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
                {T.submit.titleLabel}
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
                {T.submit.genreLabel}
              </label>
              <select value={genre} onChange={e => setGenre(e.target.value as Genre)} className={inputClass}>
                {GENRES.map(g => (
                  <option key={g} value={g}>{T.genres[g]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
                {T.submit.thumbnailLabel}
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={e => setThumbnailFile(e.target.files?.[0] ?? null)}
                required
                className="w-full bg-[#0d0d0d] border border-gray-700 px-4 py-3 text-sm text-gray-400
                  file:mr-4 file:py-1 file:px-3 file:border-0
                  file:bg-[#00ff41] file:text-black file:text-[10px] file:font-pixel file:cursor-pointer"
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#00ff41] text-black font-pixel text-[11px] py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50 tracking-widest"
            >
              {isPending ? s.publishing : s.publishBtn}
            </button>
          </form>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 border border-gray-700 text-gray-400 font-pixel text-[10px] py-2.5 hover:border-gray-500 transition-colors tracking-widest"
        >
          {s.cancel}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: /play 라우트** — `app/play/[id]/route.ts`

```ts
import { createAdminClient } from '@/lib/supabase/admin'

// 게시된 스튜디오 게임의 최신 버전 HTML을 서빙한다.
// studio_versions는 RLS로 소유자만 읽을 수 있으므로 admin 클라이언트를 쓰되,
// games에 게시 레코드가 있는 프로젝트만 공개한다.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: game } = await admin
    .from('games').select('id').eq('studio_project_id', id).limit(1).maybeSingle()
  if (!game) return new Response('Not Found', { status: 404 })

  const { data: version } = await admin
    .from('studio_versions').select('html')
    .eq('project_id', id).order('version', { ascending: false })
    .limit(1).maybeSingle()
  if (!version) return new Response('Not Found', { status: 404 })

  return new Response((version as { html: string }).html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // 최상위 문서로 열려도 스크립트 격리 유지
      'Content-Security-Policy':
        "sandbox allow-scripts allow-pointer-lock; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:;",
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 3: 페이지에 모달 연결** — `app/studio/[id]/page.tsx`의 Task 7 자리표시 블록을 교체:

```tsx
// import 추가
import PublishModal from '@/components/studio/PublishModal'

// 자리표시 div 제거하고:
      {showPublish && (
        <PublishModal
          projectId={id}
          defaultTitle={project.title}
          onClose={() => setShowPublish(false)}
        />
      )}
```

- [ ] **Step 4: 수동 검증**

1. 제작 화면에서 "게시하기" → 제목/장르/썸네일 입력 → PUBLISH.
Expected: `games`에 레코드 생성(`play_url`이 `/play/<projectId>`, `studio_project_id` 세팅), `/games` 목록에 카드 노출.
2. 새 탭에서 `/play/<projectId>` 직접 열기 → 게임 플레이 가능 (로그아웃 상태에서도).
3. 미게시 프로젝트 id로 `/play/<id>` → 404.
4. 같은 프로젝트에서 다시 "게시하기" → "이미 게시된 게임입니다" 안내.
5. 게시 후 채팅으로 수정 → `/play/<projectId>` 새로고침 시 새 버전 반영.

- [ ] **Step 5: 린트 + 커밋**

```bash
npm run lint && git add components/studio/PublishModal.tsx app/play app/studio
git commit -m "feat(studio): publish to games list and serve published games at /play"
```

---

### Task 11: 최종 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트/린트/빌드**

```bash
npm test && npm run lint && npm run build
```
Expected: 모두 통과, 빌드 에러 없음

- [ ] **Step 2: E2E 시나리오 재확인** (dev 서버)

1. 신규 브라우저(시크릿) → 회원가입/로그인 → STUDIO 메뉴 → 잔액 30
2. 게임 생성 2회(30→10) → 3회째 402 → "크레딧이 부족합니다" + 충전 유도
3. `/credits` → Sandbox 결제(또는 Task 8 curl) → 잔액 +100
4. 다시 생성 성공 → 게시 → `/games` 카드 → 플레이
5. 버전 되돌리기, 페이지 새로고침 후 상태 복원 확인

- [ ] **Step 3: superpowers:verification-before-completion 체크 후 완료 보고**
