# Vibrax Studio — 프롬프트 기반 게임 제작 + 크레딧 결제 Design Spec
*Date: 2026-07-09*

## Overview

vibrax 안에서 프롬프트로 직접 게임을 만들 수 있는 "스튜디오" 기능. 왼쪽 ChatGPT 스타일 채팅에서 프롬프트를 보내면 Claude가 단일 HTML 게임을 생성하고, 오른쪽 화면의 sandboxed iframe에 즉시 띄운다. 생성/수정 요청은 크레딧을 차감하며, 크레딧은 Paddle(해외 결제, Merchant of Record)로 충전한다. 완성된 게임은 버튼 클릭으로 기존 게임 목록에 게시할 수 있다.

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 생성 방식 | 단일 HTML 게임 — 매 요청마다 전체 재생성 (diff 방식 아님) |
| 실행 방식 | sandboxed iframe (`sandbox="allow-scripts"`, srcdoc) |
| 과금 모델 | 크레딧 충전제 (원장 방식) |
| 결제 서비스 | Paddle (MoR, 한국 사업자 지원, 글로벌 세금 처리 대행) |
| 공개 흐름 | "게시하기" 버튼 → 기존 `games` 테이블에 등록 |
| 메뉴 이름 | 스튜디오 (Studio), 라우트 `/studio` |
| 생성 모델 | claude-sonnet-5 |

## Routes

| Route | 설명 | 인증 |
|---|---|---|
| `/studio` | 내 프로젝트 목록 + 새 게임 만들기 + 크레딧 잔액 | 필요 |
| `/studio/[id]` | 제작 화면 — 좌 채팅 / 우 프리뷰 | 필요 (본인만) |
| `/credits` | 크레딧 충전 (Paddle Overlay Checkout) | 필요 |
| `/play/[id]` | 게시된 게임 플레이 (최신 버전 HTML 서빙) | 불필요 |
| `POST /api/studio/generate` | 게임 생성/수정 스트리밍 API | 필요 |
| `POST /api/webhooks/paddle` | Paddle 웹훅 — 크레딧 지급 | 서명 검증 |

NavBar에 "스튜디오" 메뉴 추가 (기존 레일 아이콘 패턴 따름).

## 제작 화면 레이아웃 (`/studio/[id]`)

```
┌──────────────────────┬──────────────────────────────┐
│  채팅 (왼쪽 ~40%)      │  게임 프리뷰 (오른쪽 ~60%)      │
│  [대화 메시지들]        │  sandboxed <iframe>          │
│  생성 중엔 스트리밍      │  (srcdoc = 최신 게임 HTML)     │
│  진행 표시             │  [새로고침] [버전 기록] [게시하기]│
├──────────────────────┤                              │
│ 프롬프트 입력 + 전송     │  잔액: 120 크레딧              │
│ (1회 = 10크레딧 표기)   │                              │
└──────────────────────┴──────────────────────────────┘
```

- 생성 완료 시마다 오른쪽 iframe이 새 버전으로 갱신.
- 새 프로젝트 첫 진입: 빈 프리뷰 + "만들고 싶은 게임을 설명해 주세요" 안내.
- 버전 기록에서 이전 버전 선택 시 해당 버전을 프리뷰에 로드 (되돌리기).

## Data Model (마이그레이션 1개)

```sql
studio_projects
  id          uuid PK DEFAULT gen_random_uuid()
  user_id     uuid NOT NULL REFERENCES profiles(id)
  title       text NOT NULL DEFAULT '새 게임'   -- 첫 생성 후 AI가 지어줌
  created_at  timestamptz DEFAULT now()

studio_messages
  id          uuid PK DEFAULT gen_random_uuid()
  project_id  uuid NOT NULL REFERENCES studio_projects(id)
  role        text NOT NULL CHECK (role IN ('user','assistant'))
  content     text NOT NULL      -- assistant는 코드 제외 설명 텍스트만
  created_at  timestamptz DEFAULT now()

studio_versions
  id          uuid PK DEFAULT gen_random_uuid()
  project_id  uuid NOT NULL REFERENCES studio_projects(id)
  version     int NOT NULL       -- 프로젝트 내 1부터 증가, (project_id, version) UNIQUE
  html        text NOT NULL      -- 완결된 단일 HTML
  created_at  timestamptz DEFAULT now()

credit_ledger
  id          uuid PK DEFAULT gen_random_uuid()
  user_id     uuid NOT NULL REFERENCES profiles(id)
  amount      int NOT NULL       -- 충전 +500, 생성 -10, 환불 +10
  reason      text NOT NULL CHECK (reason IN ('purchase','generation','refund','signup_bonus'))
  ref_id      text               -- Paddle transaction id 또는 project id
  created_at  timestamptz DEFAULT now()
  -- 중복 지급 방지: reason='purchase'에 대해 ref_id UNIQUE (partial unique index)

games 테이블 변경:
  studio_project_id uuid NULL REFERENCES studio_projects(id)
```

- 잔액은 balance 컬럼 없이 **원장 합산**으로 계산. 차감은 `SECURITY DEFINER` DB 함수에서 잔액 확인 + INSERT를 원자적으로 수행 (동시 요청에도 음수 잔액 불가).
- RLS: 4개 테이블 모두 본인 것만 SELECT. INSERT/UPDATE/DELETE는 service role만.

## 크레딧 정책 (초기값)

- 생성/수정 요청 1회 = **10 크레딧**
- 가입 보너스 **30 크레딧** (기존 가입자 포함 첫 스튜디오 진입 시 1회 지급)
- 충전 팩: $5 = 100 / $20 = 450 / $50 = 1,250 크레딧

## Paddle 결제 흐름

```
/credits에서 팩 선택 → Paddle.js Overlay Checkout (카드/PayPal/Apple Pay)
  → 결제 완료 → Paddle → POST /api/webhooks/paddle (transaction.completed)
  → 서버: 웹훅 서명 검증 → credit_ledger에 지급 INSERT
    (transaction id를 ref_id로, unique 제약으로 중복 지급 차단)
  → 클라이언트: 잔액 갱신
```

- 크레딧 지급의 유일한 진입점은 웹훅. 클라이언트 리다이렉트/성공 콜백으로는 지급하지 않음.
- 결제할 사용자 매핑: Checkout 열 때 `custom_data.user_id` 전달 → 웹훅에서 회수.
- 개발 환경: Paddle Sandbox 키로 실결제 없이 전체 흐름 테스트.
- 환경변수: `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_ENV`, 팩별 price id.

## 생성 파이프라인 (`POST /api/studio/generate`)

```
요청: { projectId, prompt }
1. 세션 확인 → 프로젝트 소유권 확인
2. 크레딧 원자적 차감 (-10) — 부족 시 402 응답 → UI가 충전 유도 모달 표시
3. 컨텍스트 조립: 시스템 프롬프트(단일 HTML 게임 규칙: 외부 리소스 금지,
   캔버스 기반, 모바일 터치 대응 권장) + 최신 버전 HTML(있으면)
   + 최근 대화 몇 턴 + 새 프롬프트
4. claude-sonnet-5 스트리밍 호출 — 응답 형식:
   짧은 설명 텍스트 → <game>완결된 단일 HTML</game>
5. 클라이언트로 스트리밍 중계 (기존 app/api/user-agent/chat 패턴 재사용)
   - 설명 텍스트: 채팅 말풍선에 실시간 표시
   - <game> 내부: "코드 작성 중... N KB" 진행 표시로 대체
6. 완료 시 서버가 studio_messages(user+assistant) + studio_versions 저장,
   version = 이전 최대 + 1. 첫 생성이면 프로젝트 title도 갱신.
```

## 게시 흐름

제작 화면의 "게시하기" 버튼 → 제목/장르/썸네일 입력 폼(기존 `/submit` 폼 수준)
→ `games`에 INSERT하되 `play_url = /play/[projectId]`, `studio_project_id` 연결.
기존 게임 목록/카드/상세 UI는 변경 없이 동작. `/play/[id]`는 해당 프로젝트의
최신 버전 HTML을 `Content-Type: text/html`로 서빙 (게시된 프로젝트만).

## Error Handling

- 생성 중 API 실패 → 크레딧 자동 환불(reason='refund', ref_id=차감 건) + 채팅에 오류 메시지. 사용자 손해 없음.
- `<game>` 태그 미완성 등 파싱 실패 → 동일하게 환불.
- 웹훅 중복 수신 → ref_id unique 제약으로 이중 지급 차단, 200 응답(재시도 중단).
- 크레딧 부족 → 402 + 충전 페이지 유도.

## Testing

- 크레딧 차감/환불/중복지급 방지, `<game>` 파싱 로직을 순수 함수로 분리해 기존 `lib/**/*.test.ts` 패턴으로 유닛 테스트.
- 결제: Paddle Sandbox 수동 E2E.
- 생성 파이프라인: 실제 API 호출로 수동 확인.

## Non-Goals (이번 범위 제외)

- 구독제, 게임 판매 수익 배분
- 멀티파일/외부 에셋 게임
- diff 기반 수정 최적화
- 버전 간 diff 뷰어
- 토스페이먼츠 등 국내 PG 연동
