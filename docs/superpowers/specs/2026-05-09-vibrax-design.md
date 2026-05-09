# Vibrax — Design Spec
*Date: 2026-05-09*

## Overview

바이브코딩(AI 도구로 제작)으로 만들어진 게임을 공유하는 플랫폼. 개발자는 Railway 등 외부 서비스에 게임을 배포한 뒤, 배포 URL과 썸네일을 등록하면 Vibrax 사이트에 공개된다. Roblox/Minecraft 커뮤니티 사이트에서 영감을 받은 레트로/픽셀 감성의 게임 디렉토리.

## Tech Stack

- **Frontend/Backend**: Next.js 14 (App Router, Server Components)
- **Database & Auth**: Supabase (PostgreSQL + Supabase Auth)
- **Storage**: Supabase Storage (썸네일 이미지)
- **Styling**: Tailwind CSS + Press Start 2P (픽셀 폰트, Google Fonts)
- **Deployment**: Vercel (권장)

## Page Structure & Routing

| Route | Description | Auth Required |
|-------|-------------|---------------|
| `/` | 홈 — 히어로 섹션 + 장르별 게임 카드 | No |
| `/games` | 전체 게임 목록 (장르 필터) | No |
| `/games/[id]` | 게임 상세 페이지 | No |
| `/submit` | 게임 등록 폼 | Yes |
| `/login` | 로그인 | No |
| `/signup` | 회원가입 | No |

## Data Model

### `profiles` table
```sql
id          uuid PRIMARY KEY REFERENCES auth.users(id)
username    text NOT NULL
created_at  timestamptz DEFAULT now()
```

### `games` table
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
title         text NOT NULL
genre         text NOT NULL CHECK (genre IN ('action', 'adventure', 'strategy', 'sports'))
play_url      text NOT NULL
thumbnail_url text NOT NULL
user_id       uuid NOT NULL REFERENCES profiles(id)
created_at    timestamptz DEFAULT now()
```

### Supabase Storage
- 버킷: `thumbnails` (public read)
- 파일 경로: `{user_id}/{uuid}.{ext}`

### Row Level Security (RLS)
- `games` SELECT: 모든 사용자 (비회원 포함)
- `games` INSERT/UPDATE/DELETE: 인증된 본인(`user_id = auth.uid()`)만
- `profiles` SELECT: 모든 사용자
- `profiles` INSERT: 본인만 (`id = auth.uid()`)

## Component Architecture

### Server Components (데이터 패칭)
- `GameListPage` — Supabase에서 게임 목록 서버사이드 패칭
- `GameDetailPage` — 개별 게임 데이터 서버사이드 패칭

### Client Components (인터랙션)
- `HeroSection` — 픽셀 헤드라인 + CTA
- `GenreFilter` — 장르 탭 (URL 쿼리 파라미터 `?genre=action` 연동)
- `GameCard` — 썸네일 + 제목 + 장르 뱃지, 클릭 시 `play_url`로 `target="_blank"`
- `GameSubmitForm` — 제목, 장르, URL, 썸네일 파일 업로드
- `AuthGuard` — 미로그인 시 `/login?redirect=/submit` 리다이렉트

## Authentication Flow

```
회원가입: /signup → supabase.auth.signUp() → 이메일 인증 메일 발송
          → 인증 완료 → DB trigger로 profiles 레코드 자동 생성

로그인:   /login  → supabase.auth.signInWithPassword()
          → 세션 쿠키 저장 (Next.js middleware로 관리)

게임등록: /submit 진입 → Next.js middleware에서 세션 확인
          → 없으면 /login?redirect=/submit 리다이렉트
          → 있으면 폼 표시 → 썸네일 Storage 업로드 → games 테이블 INSERT
```

## Design System

- **테마**: Retro/Pixel
- **폰트**: Press Start 2P (헤드라인, 뱃지), system-ui (본문)
- **배경**: 다크 (#0a0a0a ~ #111)
- **액센트**: 픽셀 그린 (#00ff41) 또는 레트로 오렌지 (#ff6b00)
- **보더 스타일**: 4px solid 픽셀 박스 (box-shadow로 픽셀 테두리 효과)
- **카드 레이아웃**: 16:9 썸네일 + 하단 텍스트 영역

## Homepage Copy Direction

히어로 섹션 메시지 방향:
> "고전 게임, AI로 다시 태어나다. 바이브코딩으로 직접 만든 게임을 세상과 공유하세요."

장르별 섹션으로 분류하여 스크롤 유도.

## Non-Goals (이번 범위 제외)

- 게임 내 플레이 (iframe 임베드 없음 — 외부 링크만)
- 댓글/좋아요/평점 시스템
- 게임 검색 기능
- 관리자 어드민 패널
- 소셜 로그인 (Google OAuth 등)
