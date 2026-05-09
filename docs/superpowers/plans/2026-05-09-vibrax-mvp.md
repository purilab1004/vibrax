# Vibrax MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 바이브코딩 게임 공유 플랫폼 MVP — 비회원 게임 목록 열람, 회원 게임 등록(썸네일·제목·링크), 장르(액션/어드벤처/전략/스포츠) 필터.

**Architecture:** Next.js 14 App Router + Server Components로 게임 목록 SSR(SEO 최적화), Client Components로 인터랙션 처리. Supabase로 PostgreSQL DB·인증·Storage를 단일 서비스로 통합. Next.js middleware로 `/submit` 라우트 인증 보호.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth + Storage), Press Start 2P (Google Fonts, 픽셀 폰트), Vercel 배포

---

## File Map

```
vibrax/
├── app/
│   ├── layout.tsx                  # 루트 레이아웃 (폰트, NavBar)
│   ├── globals.css                 # Tailwind + 픽셀 유틸리티
│   ├── page.tsx                    # 홈 (HeroSection + 장르별 게임)
│   ├── games/
│   │   ├── page.tsx                # 전체 게임 목록 (장르 필터)
│   │   └── [id]/
│   │       └── page.tsx            # 게임 상세
│   ├── submit/
│   │   └── page.tsx                # 게임 등록 (로그인 필요)
│   ├── login/
│   │   └── page.tsx
│   └── signup/
│       └── page.tsx
├── components/
│   ├── NavBar.tsx                  # 상단 내비게이션 (인증 상태 반응)
│   ├── HeroSection.tsx             # 홈 히어로 섹션
│   ├── GameCard.tsx                # 게임 카드 (썸네일 + 뱃지)
│   ├── GenreFilter.tsx             # 장르 탭 필터 (URL 쿼리 연동)
│   └── GameSubmitForm.tsx          # 게임 등록 폼 (파일 업로드 포함)
├── lib/
│   └── supabase/
│       ├── types.ts                # DB 타입 정의
│       ├── client.ts               # 브라우저 Supabase 클라이언트
│       └── server.ts               # 서버 Supabase 클라이언트
├── middleware.ts                   # /submit 인증 가드
├── next.config.ts                  # 외부 이미지 허용 설정
└── tailwind.config.ts              # 픽셀 폰트 설정
```

---

## Task 1: 프로젝트 초기화

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `app/globals.css`

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
cd /Users/sungjunahn/Documents/vibrax
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

프롬프트가 나오면 전부 기본값(Enter) 선택.

- [ ] **Step 2: Supabase 패키지 설치**

```bash
npm install @supabase/ssr @supabase/supabase-js
```

Expected: `added X packages` 메시지.

- [ ] **Step 3: next.config.ts — Supabase Storage 이미지 허용**

`next.config.ts`를 아래로 교체:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 4: tailwind.config.ts — 픽셀 폰트 변수 추가**

`tailwind.config.ts`의 `theme.extend`에 fontFamily 추가:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['var(--font-pixel)', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 5: app/globals.css — 픽셀 보더 유틸리티 추가**

파일 상단 Tailwind 지시문 아래에 추가:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .pixel-border {
    box-shadow:
      4px 0 0 0 #00ff41,
      -4px 0 0 0 #00ff41,
      0 4px 0 0 #00ff41,
      0 -4px 0 0 #00ff41;
  }
}
```

- [ ] **Step 6: 개발 서버 실행 확인**

```bash
npm run dev
```

Expected: `http://localhost:3000` 에서 Next.js 기본 페이지 표시.

- [ ] **Step 7: git 초기화 및 커밋**

```bash
git init
git add .
git commit -m "chore: initialize Next.js project with Supabase and Tailwind"
```

---

## Task 2: Supabase 프로젝트 설정 (수동)

**Files:**
- `.env.local` (새로 생성)

- [ ] **Step 1: Supabase 프로젝트 생성**

[https://supabase.com/dashboard](https://supabase.com/dashboard) 에서 새 프로젝트 생성. 이름: `vibrax`, 지역: Northeast Asia (Tokyo).

- [ ] **Step 2: 데이터베이스 테이블 생성**

Supabase Dashboard → SQL Editor → New query 에서 실행:

```sql
-- profiles 테이블
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- games 테이블
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  genre TEXT NOT NULL CHECK (genre IN ('action', 'adventure', 'strategy', 'sports')),
  play_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- profiles RLS 정책
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());

-- games RLS 정책
CREATE POLICY "games_select_all" ON games FOR SELECT USING (true);
CREATE POLICY "games_insert_own" ON games FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "games_update_own" ON games FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "games_delete_own" ON games FOR DELETE USING (user_id = auth.uid());

-- 회원가입 시 profiles 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (NEW.id, SPLIT_PART(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

Expected: "Success. No rows returned" 메시지.

- [ ] **Step 3: Storage 버킷 생성**

Supabase Dashboard → Storage → New bucket:
- Name: `thumbnails`
- Public bucket: ✅ 체크

버킷 생성 후 Storage Policies에서 아래 정책 추가 (SQL Editor):

```sql
-- 인증된 사용자만 업로드 가능
CREATE POLICY "thumbnails_upload_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 모든 사용자 읽기 가능 (public 버킷이므로 자동 적용)
```

- [ ] **Step 4: .env.local 파일 생성**

Supabase Dashboard → Settings → API 에서 값을 복사:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 5: .gitignore에 .env.local 추가 확인**

```bash
grep ".env.local" .gitignore
```

Expected: `.env.local` 라인이 존재. 없으면 추가:

```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 6: 커밋**

```bash
git add .gitignore next.config.ts
git commit -m "chore: configure Supabase environment and image domains"
```

---

## Task 3: Supabase 클라이언트 유틸리티

**Files:**
- Create: `lib/supabase/types.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: lib/supabase/types.ts 생성**

```typescript
export type Genre = 'action' | 'adventure' | 'strategy' | 'sports'

export interface Game {
  id: string
  title: string
  genre: Genre
  play_url: string
  thumbnail_url: string
  user_id: string
  created_at: string
}

export interface Profile {
  id: string
  username: string
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<Profile, 'id'>>
      }
      games: {
        Row: Game
        Insert: Omit<Game, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Game, 'id'>>
      }
    }
  }
}
```

- [ ] **Step 2: lib/supabase/client.ts 생성 (브라우저용)**

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: lib/supabase/server.ts 생성 (서버용)**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 4: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add lib/
git commit -m "feat: add Supabase client utilities and database types"
```

---

## Task 4: Auth Middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: middleware.ts 생성**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/submit')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', '/submit')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/submit/:path*'],
}
```

- [ ] **Step 2: 수동 검증**

개발 서버 실행 상태에서 브라우저로 `http://localhost:3000/submit` 접속.
Expected: `/login?redirect=%2Fsubmit` 으로 리다이렉트.

- [ ] **Step 3: 커밋**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware to protect /submit route"
```

---

## Task 5: 루트 레이아웃 + NavBar

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/NavBar.tsx`

- [ ] **Step 1: components/NavBar.tsx 생성**

```typescript
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="border-b-4 border-[#00ff41] bg-[#0a0a0a] px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="font-pixel text-[#00ff41] text-sm tracking-widest hover:text-white transition-colors"
        >
          VIBRAX
        </Link>
        <div className="flex items-center gap-6 text-xs">
          <Link href="/games" className="hover:text-[#00ff41] transition-colors">
            GAMES
          </Link>
          {user ? (
            <>
              <Link
                href="/submit"
                className="hover:text-[#00ff41] transition-colors"
              >
                + SUBMIT
              </Link>
              <button
                onClick={handleSignOut}
                className="hover:text-[#00ff41] transition-colors"
              >
                LOGOUT
              </button>
            </>
          ) : (
            <Link href="/login" className="hover:text-[#00ff41] transition-colors">
              LOGIN
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: app/layout.tsx 교체**

```typescript
import type { Metadata } from 'next'
import { Press_Start_2P } from 'next/font/google'
import './globals.css'
import NavBar from '@/components/NavBar'

const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Vibrax — 바이브코딩 게임 플랫폼',
  description:
    '고전 게임, AI로 다시 태어나다. 바이브코딩으로 만든 게임을 공유하세요.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className={pixelFont.variable}>
      <body className="bg-[#0a0a0a] text-white min-h-screen">
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: 브라우저 확인**

`http://localhost:3000` 접속.
Expected: 상단에 `VIBRAX` 로고와 `GAMES`, `LOGIN` 링크가 있는 픽셀 스타일 NavBar 표시.

- [ ] **Step 4: 커밋**

```bash
git add app/layout.tsx components/NavBar.tsx app/globals.css
git commit -m "feat: add root layout with pixel font and NavBar"
```

---

## Task 6: 로그인 + 회원가입 페이지

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/signup/page.tsx`

- [ ] **Step 1: app/login/page.tsx 생성**

```typescript
'use client'

import { useState, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'
  const supabase = createClient()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      router.push(redirect)
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-pixel text-[#00ff41] text-lg mb-8 text-center">LOGIN</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs mb-2 text-gray-400 font-pixel">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#111] border-2 border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs mb-2 text-gray-400 font-pixel">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[#111] border-2 border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#00ff41] text-black font-pixel text-xs py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50"
          >
            {isPending ? 'LOADING...' : 'LOGIN'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-500 mt-6">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-[#00ff41] hover:underline">
            SIGNUP
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
```

- [ ] **Step 2: app/signup/page.tsx 생성**

```typescript
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      setMessage('인증 이메일을 확인해주세요. 이메일 링크 클릭 후 로그인 가능합니다.')
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-pixel text-[#00ff41] text-lg mb-8 text-center">SIGNUP</h1>
        {message ? (
          <p className="text-center text-sm text-[#00ff41] leading-relaxed">{message}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs mb-2 text-gray-400 font-pixel">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-[#111] border-2 border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs mb-2 text-gray-400 font-pixel">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-[#111] border-2 border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors"
              />
              <p className="text-xs text-gray-600 mt-1">최소 6자리</p>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#00ff41] text-black font-pixel text-xs py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50"
            >
              {isPending ? 'LOADING...' : 'CREATE ACCOUNT'}
            </button>
          </form>
        )}
        <p className="text-center text-xs text-gray-500 mt-6">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-[#00ff41] hover:underline">
            LOGIN
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 브라우저 확인**

`http://localhost:3000/login` — 픽셀 스타일 로그인 폼 표시 확인.
`http://localhost:3000/signup` — 회원가입 폼 표시 확인.

- [ ] **Step 4: 커밋**

```bash
git add app/login/ app/signup/
git commit -m "feat: add login and signup pages with Supabase Auth"
```

---

## Task 7: GameCard 컴포넌트

**Files:**
- Create: `components/GameCard.tsx`

- [ ] **Step 1: components/GameCard.tsx 생성**

```typescript
import Image from 'next/image'
import type { Game } from '@/lib/supabase/types'

const GENRE_LABELS: Record<Game['genre'], string> = {
  action: 'ACTION',
  adventure: 'ADVENTURE',
  strategy: 'STRATEGY',
  sports: 'SPORTS',
}

const GENRE_COLORS: Record<Game['genre'], string> = {
  action: 'bg-red-700',
  adventure: 'bg-yellow-700',
  strategy: 'bg-blue-700',
  sports: 'bg-green-700',
}

interface GameCardProps {
  game: Game
}

export default function GameCard({ game }: GameCardProps) {
  return (
    <a
      href={game.play_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="border-2 border-gray-700 group-hover:border-[#00ff41] transition-colors bg-[#111]">
        <div className="relative aspect-video w-full overflow-hidden">
          <Image
            src={game.thumbnail_url}
            alt={game.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="p-3">
          <span
            className={`inline-block text-[10px] font-pixel px-2 py-1 text-white ${GENRE_COLORS[game.genre]}`}
          >
            {GENRE_LABELS[game.genre]}
          </span>
          <h3 className="mt-2 text-sm font-semibold text-white truncate">{game.title}</h3>
        </div>
      </div>
    </a>
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add components/GameCard.tsx
git commit -m "feat: add GameCard component with genre badge"
```

---

## Task 8: HeroSection 컴포넌트

**Files:**
- Create: `components/HeroSection.tsx`

- [ ] **Step 1: components/HeroSection.tsx 생성**

```typescript
import Link from 'next/link'

export default function HeroSection() {
  return (
    <section className="relative py-24 px-6 text-center overflow-hidden">
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(#00ff41 1px, transparent 1px),
            linear-gradient(90deg, #00ff41 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />
      <div className="relative max-w-3xl mx-auto">
        <p className="font-pixel text-[#00ff41] text-[10px] tracking-widest mb-6">
          VIBE CODED · AI POWERED · RETRO SPIRIT
        </p>
        <h1 className="font-pixel text-white text-xl md:text-3xl leading-loose mb-8">
          고전 게임,<br />
          <span className="text-[#00ff41]">AI</span>로 다시 태어나다
        </h1>
        <p className="text-gray-400 text-sm md:text-base mb-10 leading-relaxed max-w-xl mx-auto">
          ChatGPT, Claude, 그 어떤 AI든 상관없어요.<br />
          직접 만든 게임을 Railway에 배포하고 Vibrax에 공유하세요.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/games"
            className="font-pixel text-xs bg-[#00ff41] text-black px-6 py-3 hover:bg-[#00cc33] transition-colors"
          >
            PLAY GAMES
          </Link>
          <Link
            href="/submit"
            className="font-pixel text-xs border-2 border-[#00ff41] text-[#00ff41] px-6 py-3 hover:bg-[#00ff41] hover:text-black transition-colors"
          >
            SUBMIT GAME
          </Link>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/HeroSection.tsx
git commit -m "feat: add HeroSection with pixel grid background"
```

---

## Task 9: 홈 페이지

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: app/page.tsx 교체**

```typescript
import { createClient } from '@/lib/supabase/server'
import HeroSection from '@/components/HeroSection'
import GameCard from '@/components/GameCard'
import Link from 'next/link'
import type { Game } from '@/lib/supabase/types'

const GENRES: { key: Game['genre']; label: string }[] = [
  { key: 'action', label: 'ACTION' },
  { key: 'adventure', label: 'ADVENTURE' },
  { key: 'strategy', label: 'STRATEGY' },
  { key: 'sports', label: 'SPORTS' },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false })

  const gamesByGenre = (genre: Game['genre']) =>
    (games ?? []).filter(g => g.genre === genre)

  const hasAnyGame = (games ?? []).length > 0

  return (
    <div>
      <HeroSection />
      <div className="max-w-7xl mx-auto px-6 py-16 space-y-16">
        {hasAnyGame ? (
          GENRES.map(({ key, label }) => {
            const genreGames = gamesByGenre(key)
            if (genreGames.length === 0) return null
            return (
              <section key={key}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-pixel text-[#00ff41] text-sm">{label}</h2>
                  <Link
                    href={`/games?genre=${key}`}
                    className="text-xs text-gray-500 hover:text-[#00ff41] transition-colors"
                  >
                    VIEW ALL →
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {genreGames.slice(0, 4).map(game => (
                    <GameCard key={game.id} game={game} />
                  ))}
                </div>
              </section>
            )
          })
        ) : (
          <div className="text-center py-24">
            <p className="text-gray-500 text-sm mb-6">
              아직 등록된 게임이 없습니다.
            </p>
            <Link
              href="/submit"
              className="font-pixel text-xs border-2 border-[#00ff41] text-[#00ff41] px-6 py-3 hover:bg-[#00ff41] hover:text-black transition-colors"
            >
              첫 번째 게임 등록하기
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 브라우저 확인**

`http://localhost:3000` 접속.
Expected: HeroSection + "아직 등록된 게임이 없습니다." 메시지 표시.

- [ ] **Step 3: 커밋**

```bash
git add app/page.tsx
git commit -m "feat: implement home page with HeroSection and genre sections"
```

---

## Task 10: GenreFilter 컴포넌트

**Files:**
- Create: `components/GenreFilter.tsx`

- [ ] **Step 1: components/GenreFilter.tsx 생성**

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Genre } from '@/lib/supabase/types'

type GenreOption = Genre | 'all'

const GENRES: { key: GenreOption; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'action', label: 'ACTION' },
  { key: 'adventure', label: 'ADVENTURE' },
  { key: 'strategy', label: 'STRATEGY' },
  { key: 'sports', label: 'SPORTS' },
]

export default function GenreFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = (searchParams.get('genre') ?? 'all') as GenreOption

  const handleSelect = (genre: GenreOption) => {
    const params = new URLSearchParams(searchParams.toString())
    if (genre === 'all') {
      params.delete('genre')
    } else {
      params.set('genre', genre)
    }
    const query = params.toString()
    router.push(`/games${query ? `?${query}` : ''}`)
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {GENRES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => handleSelect(key)}
          className={`font-pixel text-[10px] px-4 py-2 border-2 transition-colors ${
            current === key
              ? 'bg-[#00ff41] text-black border-[#00ff41]'
              : 'text-gray-400 border-gray-700 hover:border-[#00ff41] hover:text-[#00ff41]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/GenreFilter.tsx
git commit -m "feat: add GenreFilter component with URL query sync"
```

---

## Task 11: 게임 목록 페이지

**Files:**
- Create: `app/games/page.tsx`

- [ ] **Step 1: app/games/page.tsx 생성**

```typescript
import { createClient } from '@/lib/supabase/server'
import GameCard from '@/components/GameCard'
import GenreFilter from '@/components/GenreFilter'
import { Suspense } from 'react'
import type { Genre } from '@/lib/supabase/types'

const VALID_GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

interface Props {
  searchParams: Promise<{ genre?: string }>
}

async function GameGrid({ genre }: { genre?: string }) {
  const supabase = await createClient()
  const validGenre = VALID_GENRES.includes(genre as Genre) ? (genre as Genre) : undefined

  let query = supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false })

  if (validGenre) {
    query = query.eq('genre', validGenre)
  }

  const { data: games } = await query

  if (!games || games.length === 0) {
    return (
      <p className="text-center text-gray-500 text-sm py-24">
        {validGenre ? '해당 장르의 게임이 없습니다.' : '아직 등록된 게임이 없습니다.'}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {games.map(game => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  )
}

export default async function GamesPage({ searchParams }: Props) {
  const { genre } = await searchParams

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h1 className="font-pixel text-[#00ff41] text-lg mb-8">GAMES</h1>
      <div className="mb-8">
        <Suspense>
          <GenreFilter />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="text-center text-gray-500 text-sm py-24">Loading...</div>
        }
      >
        <GameGrid genre={genre} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: 브라우저 확인**

`http://localhost:3000/games` 접속.
Expected: "GAMES" 제목 + 장르 필터 탭 + 게임 없음 메시지 표시.

`http://localhost:3000/games?genre=action` 접속.
Expected: ACTION 탭이 활성화(초록 배경).

- [ ] **Step 3: 커밋**

```bash
git add app/games/
git commit -m "feat: add games list page with genre filter"
```

---

## Task 12: 게임 상세 페이지

**Files:**
- Create: `app/games/[id]/page.tsx`

- [ ] **Step 1: app/games/[id]/page.tsx 생성**

```typescript
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

const GENRE_LABELS: Record<string, string> = {
  action: 'ACTION',
  adventure: 'ADVENTURE',
  strategy: 'STRATEGY',
  sports: 'SPORTS',
}

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: game } = await supabase
    .from('games')
    .select('title')
    .eq('id', id)
    .single()
  return { title: game ? `${game.title} — Vibrax` : 'Game — Vibrax' }
}

export default async function GameDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: game } = await supabase
    .from('games')
    .select('*, profiles(username)')
    .eq('id', id)
    .single()

  if (!game) notFound()

  const author = (game.profiles as { username: string } | null)?.username ?? 'unknown'

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="relative aspect-video w-full mb-8 border-2 border-gray-700 overflow-hidden">
        <Image
          src={game.thumbnail_url}
          alt={game.title}
          fill
          className="object-cover"
          priority
        />
      </div>
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <span className="font-pixel text-xs text-[#00ff41]">
            {GENRE_LABELS[game.genre] ?? game.genre.toUpperCase()}
          </span>
          <h1 className="text-2xl font-bold mt-3 mb-2">{game.title}</h1>
          <p className="text-gray-500 text-xs">by {author}</p>
        </div>
        <a
          href={game.play_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-pixel text-xs bg-[#00ff41] text-black px-8 py-4 hover:bg-[#00cc33] transition-colors whitespace-nowrap shrink-0"
        >
          ▶ PLAY NOW
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add app/games/
git commit -m "feat: add game detail page with thumbnail and play button"
```

---

## Task 13: GameSubmitForm + 게임 등록 페이지

**Files:**
- Create: `components/GameSubmitForm.tsx`
- Create: `app/submit/page.tsx`

- [ ] **Step 1: components/GameSubmitForm.tsx 생성**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Genre } from '@/lib/supabase/types'

const GENRES: { value: Genre; label: string }[] = [
  { value: 'action', label: 'ACTION' },
  { value: 'adventure', label: 'ADVENTURE' },
  { value: 'strategy', label: 'STRATEGY' },
  { value: 'sports', label: 'SPORTS' },
]

export default function GameSubmitForm({ userId }: { userId: string }) {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState<Genre>('action')
  const [playUrl, setPlayUrl] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!thumbnailFile) {
      setError('썸네일을 업로드해주세요.')
      return
    }
    setError(null)
    startTransition(async () => {
      const ext = thumbnailFile.name.split('.').pop() ?? 'png'
      const path = `${userId}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(path, thumbnailFile, { upsert: false })

      if (uploadError) {
        setError(`업로드 실패: ${uploadError.message}`)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('thumbnails').getPublicUrl(path)

      const { error: insertError } = await supabase.from('games').insert({
        title,
        genre,
        play_url: playUrl,
        thumbnail_url: publicUrl,
        user_id: userId,
      })

      if (insertError) {
        setError(`등록 실패: ${insertError.message}`)
        return
      }

      router.push('/games')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label className="block text-xs mb-2 text-gray-400 font-pixel">TITLE</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          placeholder="게임 제목"
          className="w-full bg-[#111] border-2 border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs mb-2 text-gray-400 font-pixel">GENRE</label>
        <select
          value={genre}
          onChange={e => setGenre(e.target.value as Genre)}
          className="w-full bg-[#111] border-2 border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors"
        >
          {GENRES.map(g => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs mb-2 text-gray-400 font-pixel">PLAY URL</label>
        <input
          type="url"
          value={playUrl}
          onChange={e => setPlayUrl(e.target.value)}
          required
          placeholder="https://your-game.railway.app"
          className="w-full bg-[#111] border-2 border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs mb-2 text-gray-400 font-pixel">THUMBNAIL</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={e => setThumbnailFile(e.target.files?.[0] ?? null)}
          required
          className="w-full bg-[#111] border-2 border-gray-700 px-4 py-3 text-sm text-gray-400
            file:mr-4 file:py-1 file:px-3 file:border-0
            file:bg-[#00ff41] file:text-black file:text-xs file:font-pixel file:cursor-pointer"
        />
        {thumbnailFile && (
          <p className="text-xs text-gray-400 mt-1">{thumbnailFile.name}</p>
        )}
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#00ff41] text-black font-pixel text-xs py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50"
      >
        {isPending ? 'UPLOADING...' : 'SUBMIT GAME'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: app/submit/page.tsx 생성**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameSubmitForm from '@/components/GameSubmitForm'

export default async function SubmitPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/submit')

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h1 className="font-pixel text-[#00ff41] text-lg mb-8">SUBMIT GAME</h1>
      <p className="text-gray-400 text-sm mb-8 leading-relaxed">
        Railway, Vercel 등 외부 서비스에 배포한 게임의 URL을 등록하세요.
      </p>
      <GameSubmitForm userId={user.id} />
    </div>
  )
}
```

- [ ] **Step 3: 전체 흐름 수동 테스트**

1. `http://localhost:3000/signup` — 테스트 계정 생성
2. 이메일 인증 (Supabase Dashboard → Authentication → Users 에서 수동 인증 가능)
3. `http://localhost:3000/login` — 로그인
4. `http://localhost:3000/submit` — 폼 작성 후 게임 등록
5. `http://localhost:3000/games` — 등록한 게임 카드 표시 확인
6. 게임 카드 클릭 → 등록한 `play_url`로 이동 확인

- [ ] **Step 4: 최종 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 5: 빌드 확인**

```bash
npm run build
```

Expected: `Compiled successfully` 메시지.

- [ ] **Step 6: 최종 커밋**

```bash
git add components/GameSubmitForm.tsx app/submit/
git commit -m "feat: add game submit form with thumbnail upload to Supabase Storage"
```

---

## Task 15: SEO 최적화

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`
- Create: `public/og-image.png` (수동 생성)

트렌디한 키워드(vibe coding, vibe game, AI game, vibe programming 등)로 Google/Naver/ChatGPT Search/Grok 검색 노출 극대화.

- [ ] **Step 1: app/layout.tsx — 전역 메타데이터 강화**

`metadata` 객체를 아래로 교체:

```typescript
export const metadata: Metadata = {
  title: {
    default: 'Vibrax — AI 바이브코딩 게임 플랫폼',
    template: '%s | Vibrax',
  },
  description:
    'AI로 만든 게임을 공유하는 바이브코딩 플랫폼. Claude, ChatGPT로 만든 액션, 어드벤처, 전략, 스포츠 게임을 즐기고 등록하세요. Vibe coding, AI game, vibe programming 커뮤니티.',
  keywords: [
    'vibe coding',
    'vibe game',
    'AI game',
    'vibe programming',
    'AI coding game',
    'ChatGPT game',
    'Claude game',
    'AI 게임',
    'AI 바이브코딩',
    '바이브코딩 게임',
    'vibe code',
    'AI generated game',
    'cursor game',
    'windsurf game',
    'no-code game',
    'indie game AI',
    'retro game AI',
    'AI game platform',
    'play AI games',
    'AI game sharing',
  ],
  authors: [{ name: 'Vibrax' }],
  creator: 'Vibrax',
  metadataBase: new URL('https://vibrax.vercel.app'),
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://vibrax.vercel.app',
    siteName: 'Vibrax',
    title: 'Vibrax — AI 바이브코딩 게임 플랫폼',
    description:
      'Claude, ChatGPT 등 AI로 만든 게임을 공유하는 바이브코딩 커뮤니티. 지금 바로 플레이하거나 직접 만든 게임을 등록하세요.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Vibrax — AI 바이브코딩 게임 플랫폼',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vibrax — AI 바이브코딩 게임 플랫폼',
    description:
      'Claude, ChatGPT 등 AI로 만든 게임을 공유하는 바이브코딩 커뮤니티.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://vibrax.vercel.app',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}
```

`Metadata` import 위에 `URL` 사용을 위해 타입 체크 확인.

- [ ] **Step 2: app/games/[id]/page.tsx — 게임별 동적 OG 태그**

`generateMetadata` 함수를 아래로 교체:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: game } = await supabase
    .from('games')
    .select('title, genre, thumbnail_url')
    .eq('id', id)
    .single()

  if (!game) return { title: 'Game — Vibrax' }

  const genreLabel = GENRE_LABELS[game.genre] ?? game.genre
  return {
    title: `${game.title} — Vibrax`,
    description: `${game.title}은(는) AI 바이브코딩으로 만들어진 ${genreLabel} 게임입니다. Vibrax에서 지금 바로 플레이하세요.`,
    openGraph: {
      title: `${game.title} — Vibrax`,
      description: `AI 바이브코딩 ${genreLabel} 게임 — ${game.title}`,
      images: [{ url: game.thumbnail_url, alt: game.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${game.title} — Vibrax`,
      images: [game.thumbnail_url],
    },
  }
}
```

- [ ] **Step 3: app/sitemap.ts 생성**

```typescript
import { createClient } from '@/lib/supabase/server'
import type { MetadataRoute } from 'next'

const BASE_URL = 'https://vibrax.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  const { data: games } = await supabase
    .from('games')
    .select('id, created_at')
    .order('created_at', { ascending: false })

  const gameUrls: MetadataRoute.Sitemap = (games ?? []).map(game => ({
    url: `${BASE_URL}/games/${game.id}`,
    lastModified: new Date(game.created_at),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/games`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...gameUrls,
  ]
}
```

- [ ] **Step 4: app/robots.ts 생성**

```typescript
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/submit', '/login', '/signup'],
      },
    ],
    sitemap: 'https://vibrax.vercel.app/sitemap.xml',
  }
}
```

- [ ] **Step 5: OG 이미지 생성**

`public/og-image.png` (1200×630px) 를 직접 제작하거나 [https://og-playground.vercel.app](https://og-playground.vercel.app) 에서 생성.
내용: 검정 배경 + "VIBRAX" 픽셀 로고 + "AI 바이브코딩 게임 플랫폼" 텍스트 + 초록 액센트.

- [ ] **Step 6: 타입 체크 및 빌드**

```bash
npx tsc --noEmit && npm run build
```

Expected: 에러 없음, `Route /sitemap.xml` 생성 확인.

- [ ] **Step 7: 배포 후 Google Search Console 등록**

배포 완료 후:
1. [Google Search Console](https://search.google.com/search-console) → 속성 추가 → `https://vibrax.vercel.app`
2. Sitemap 제출: `https://vibrax.vercel.app/sitemap.xml`
3. [Naver Search Advisor](https://searchadvisor.naver.com) → 사이트 등록 → 사이트맵 제출

- [ ] **Step 8: 커밋**

```bash
git add app/layout.tsx app/sitemap.ts app/robots.ts app/games/ public/
git commit -m "feat: add SEO metadata, sitemap, robots.txt for search engine indexing"
```

---

## Task 14: Vercel 배포 (선택)

- [ ] **Step 1: Vercel CLI 배포**

```bash
npx vercel --prod
```

프롬프트에서:
- Link to existing project? → `N` (새 프로젝트)
- Project name: `vibrax`

- [ ] **Step 2: 환경 변수 설정**

Vercel Dashboard → 프로젝트 → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL` = Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key

- [ ] **Step 3: Supabase Site URL 설정**

Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://your-project.vercel.app`
- Redirect URLs: `https://your-project.vercel.app/**`

- [ ] **Step 4: 재배포**

```bash
npx vercel --prod
```
