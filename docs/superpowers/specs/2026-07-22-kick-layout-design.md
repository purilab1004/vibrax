# Kick-style Layout — Design Spec

Date: 2026-07-22 · Status: Approved by user (chat, 추천안 4개 모두 선택)

## Goal

kick.com의 왼쪽 사이드바(채널 목록) + 오른쪽 라이브 그리드 구성을 vibrexcup에 적용한다. 모든 게임 카드를 "AJ가 방송 중인 스트림 카드"처럼 보이게 해 AJ(AI 스트리머) 콘셉트를 강화한다.

## Decisions (user-confirmed)

- 사이드바: 홈+장르 메뉴 아래 **게임 채널 목록**(썸네일·제목·시청자수)
- 홈: **컴팩트 히어로**(프롬프트 입력창 유지, 높이 축소) + kick식 피처드/그리드
- AJ 표현: 카드 썸네일에 **AJ LIVE 배지 + 시청자수 오버레이**
- 범위: 홈 + /games + 사이드바

## Components

### 1. `components/Sidebar.tsx` (RightRail.tsx 대체, 파일 교체)
- 기본 **펼침(w-56)**, 토글로 아이콘 레일(w-14). 상태는 localStorage 유지
- 본문 여백은 CSS 변수로 동기화: 사이드바가 `document.documentElement`에 `--rail-w`(14rem/3.5rem) 설정, layout의 main/footer는 `md:pl-[var(--rail-w,14rem)]` + transition
- 상단: 홈 + 장르 4개(기존 아이콘·NEW 뱃지 이관)
- 하단: `LIVE CHANNELS` 헤더 + 조회수 상위 10개 게임 — 행: 원형 썸네일 + 제목(1줄)/장르 + 🔴 시청자수. 접힘 시 원형 썸네일만. 클릭 → `/games?open=<id>`는 없으니 `/games` 이동 대신 카드와 동일한 플레이 UX가 없으므로 **`/games?genre=<genre>` 아닌 게임 상세 `/games/<id>`로 이동**
- 데이터: layout.tsx의 기존 games 쿼리를 `id,title,thumbnail_url,genre,view_count,created_at`로 확장, 50개 중 조회수 상위 10개를 props로 전달 (추가 쿼리 없음)

### 2. `components/GameCard.tsx` 개편 (스트림 카드)
- 썸네일 오버레이: 좌상단 빨간 `AJ LIVE` 배지(pulse), 좌하단 `👁 1.2K` 시청자수 필 — kick 문법
- 하단 정보: 제작자 아바타(기존) + 제목 + 제작자명 · 장르 텍스트, 우측 LikeButton
- 클릭 시 플레이 모달(AiBjPanel) 등 기존 동작 전부 유지

### 3. 홈 `app/page.tsx`
- `HeroSection` 컴팩트화: min-h 480→320대, 패딩 축소, 보조 CTA 링크 제거(프롬프트 입력만)
- `components/home/LiveGrid.tsx`(client): `🔴 LIVE NOW` 헤더 + 장르 칩 필터(전체/4장르) + 통합 그리드. **피처드 = 최다 조회수 게임 1개를 `lg:col-span-2 lg:row-span-2`로 크게** (별도 컴포넌트 없이 그리드 안에서)
- 기존 장르별 세로 섹션 제거

### 4. `lib/format.ts`
- `formatViewers(n)`: `999→'999'`, `1234→'1.2K'`, `1250000→'1.3M'` (+ node:test)

### 5. i18n (ko/en)
- `sidebar.channels`('LIVE CHANNELS'), `home.liveNow`('LIVE NOW'), `home.all`('전체'/'ALL')

## 유지

상단 NavBar, 모바일 햄버거(사이드바는 md+ 전용), 픽셀·네온그린 테마, AiBjPanel/에이전트 게이트, /games 필터 로직(카드만 교체됨)

## 검증

`npm test`(formatViewers), `tsc`, `next build`, 신규 lint 에러 0, 배포 후 홈/게임목록 스모크
