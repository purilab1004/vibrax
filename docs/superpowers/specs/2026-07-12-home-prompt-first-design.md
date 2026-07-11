# 홈 프롬프트 우선(Prompt-First Hero) Design Spec
*Date: 2026-07-12*

## Overview

base44.com처럼 홈 진입 시 **대형 프롬프트 입력창이 가장 먼저** 보이게 히어로를 재구성한다.
입력 한 번으로 스튜디오의 게임 생성까지 직행한다. 히어로 아래는 기존 장르별 게임 섹션을 그대로 유지.

## 동작 흐름

```
홈 입력창에 "벽돌깨기 게임 만들어줘" + Enter
  → sessionStorage['vibrax-initial-prompt']에 저장 → /studio 이동
  → (미로그인이면 기존 /login?redirect=/studio 경유 — 프롬프트 유실 없음)
  → /studio: 저장된 프롬프트 감지 → 자동으로 새 프로젝트 생성 → /studio/[id]로 replace
  → 제작 화면: 메시지가 0개이고 저장된 프롬프트가 있으면 1회 자동 전송(중복 가드)
  → 크레딧 차감 → 생성 시작
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `components/HeroPromptInput.tsx` | 신규 — 대형 입력창 + 만들기 버튼, Enter 전송, sessionStorage 저장 후 /studio 이동 |
| `components/HeroSection.tsx` | 헤드라인을 프롬프트 중심 문구로 교체, 콘텐츠 중앙 정렬, HeroPromptInput 배치, 기존 CTA 2개는 아래 보조 링크로 유지 |
| `app/studio/page.tsx` | 마운트 시 저장된 프롬프트 있으면 자동 프로젝트 생성 → replace 이동 (실패 시 기존 createError 배너) |
| `app/studio/[id]/page.tsx` | 초기 로드 완료 후 메시지 0개 + 저장 프롬프트 존재 시 자동 send (ref로 1회 가드, 전송 직전 storage 제거) |
| `lib/i18n/translations.ts` | `hero.promptHeading/promptPlaceholder/promptCta/promptHint` ko/en 추가 |

## 에러 처리

- 자동 프로젝트 생성 실패: /studio 목록에 기존 createError 배너, storage의 프롬프트는 유지(다음 시도에 재사용)
- 자동 전송 실패(402/네트워크): 기존 composer 오류 흐름 그대로(크레딧 부족 → 충전 유도)
- 자동 전송은 세션당 1회만 — 전송 직전에 storage에서 제거해 새로고침 시 중복 차감 방지

## Non-Goals

- 홈 입력창에서 직접 스트리밍 표시 (스튜디오로 이동해서 처리)
- 기존 장르별 게임 섹션 변경 없음
