# AI BJ (방송인) 기능 설계 스펙

**날짜:** 2026-05-22  
**프로젝트:** Vibrax — AI 바이브코딩 게임 플랫폼

---

## 개요

각 게임 장르마다 전담 AI 방송인(BJ)을 배치한다. 메인 페이지의 장르 섹션에 BJ 프로필 카드를 노출하고, 게임 플레이 모달에서는 우측 패널에 실시간 채팅과 BJ 프로필을 제공한다. BJ는 Claude API를 통해 실시간 스트리밍으로 응답한다.

---

## AI BJ 캐릭터

| 장르 | 이름 | 스타일 | 장르 색상 |
|------|------|--------|-----------|
| ACTION | ACE | 빠르고 흥분된 해설, 짧고 강렬한 문장 | `border-red-600` |
| ADVENTURE | NOVA | 탐험적이고 신비로운 스토리텔러 | `border-amber-600` |
| STRATEGY | LOGIC | 분석적이고 전략 해설, 냉철한 톤 | `border-blue-600` |
| SPORTS | SPARK | 활기차고 응원하는 스포츠 캐스터 | `border-green-600` |

**아바타:** 모든 BJ 공통으로 `/public/aibot.png` 사용. 장르 색상 테두리로 구분.  
*(원본은 GLB 3D 모델, 현재는 PNG 이미지로 대체)*

---

## 아키텍처

### 메인 페이지 (`app/page.tsx`)

각 장르 섹션 헤더 아래에 `<AiBjProfileStrip genre={key} />` 삽입.  
BJ 카드 1개가 가로로 표시되며 클릭 시 해당 장르 게임 목록 섹션으로 앵커 스크롤.

### 게임 모달 (`components/GameCard.tsx`)

전체화면 모달 내부를 `flex-row`로 변경:

```
┌─────────────────────────────────┬──────────────┐
│  헤더 바 (게임명 + CLOSE)           │              │
├─────────────────────────────────┤              │
│                                 │  💬 CHAT     │
│          iframe (게임)            │  (스크롤)     │
│                                 │  입력창       │
│                                 │  ─────────   │
│                                 │  🎙 AI BJ   │
│                                 │  프로필 카드   │
└─────────────────────────────────┴──────────────┘
```

우측 패널 너비: `w-72` (288px) 고정.

---

## API

### `POST /api/ai-bj/chat`

**Runtime:** Edge  
**Request body:**
```json
{
  "genre": "action" | "adventure" | "strategy" | "sports",
  "message": "유저 메시지",
  "history": [{ "role": "user" | "assistant", "content": "..." }]
}
```

**Response:** `text/event-stream` — Claude API 스트리밍 그대로 전달  
**인증:** 불필요 (공개 API), rate limit은 향후 추가  
**환경변수:** `ANTHROPIC_API_KEY`

---

## 신규 파일

### `lib/ai-bj/personas.ts`

장르별 BJ 정의 객체:
- `name`: BJ 이름
- `genre`: 장르 키
- `borderColor`: Tailwind 테두리 클래스
- `catchphrase`: 프로필 카드 한 줄 소개
- `systemPrompt`: Claude API system 메시지
- `greeting`: 게임 시작 시 자동 첫 메시지

### `components/AiBjProfileStrip.tsx`

메인 페이지 장르 섹션 내 BJ 프로필 카드. Server Component.  
- `aibot.png` + 장르 색상 테두리
- BJ 이름 + `🔴 LIVE` 뱃지
- catchphrase 텍스트

### `components/AiBjPanel.tsx`

게임 모달 우측 패널. Client Component.  
- Props: `genre: Genre`
- 상태: `messages[]`, `input`, `isStreaming`
- 마운트 시 BJ greeting 메시지 자동 전송
- 채팅 입력 → `/api/ai-bj/chat` fetch streaming → 타이핑 효과로 메시지 추가
- 하단 BJ 프로필 카드 (aibot.png, 이름, LIVE 표시)

---

## 수정 파일

### `components/GameCard.tsx`

- 모달 내부 구조를 `flex flex-col` → 헤더 고정 + 하단 `flex flex-row`로 변경
- iframe 영역: `flex-1`
- 우측에 `<AiBjPanel genre={game.genre} />` 추가

### `app/page.tsx`

- 각 장르 섹션 `<h2>` 아래에 `<AiBjProfileStrip genre={key} />` 삽입

---

## 의존성

- `@anthropic-ai/sdk` — Claude API 클라이언트 (신규 설치 필요)
- `ANTHROPIC_API_KEY` 환경변수 (`.env.local` + Vercel 환경변수)

---

## 구현 순서

1. `lib/ai-bj/personas.ts` 작성
2. `app/api/ai-bj/chat/route.ts` 작성 (Edge streaming)
3. `components/AiBjProfileStrip.tsx` 작성
4. `components/AiBjPanel.tsx` 작성
5. `components/GameCard.tsx` 수정 (패널 통합)
6. `app/page.tsx` 수정 (프로필 스트립 삽입)
7. `@anthropic-ai/sdk` 설치 + 환경변수 설정

---

## 미결 사항

- `aibot.png` 파일을 `/public/aibot.png`으로 추가 필요 (사용자 제공)
- Rate limiting은 MVP 이후 추가
- 향후 GLB 3D 모델로 교체 가능한 구조 유지
