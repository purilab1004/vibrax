# MLPilot v2 — AJ 대화 학습 엔진 설계

## 목적
AJ(AI 스트리머)가 **게임·상황·감정·상대 말투**에 맞게 더 잘 말하도록, 대화 데이터를 축적하고 AJ 프롬프트에 반영하는 학습 루프. 파인튜닝 대신 **지식베이스 + 상황별 예시 검색(RAG-lite) + 규칙/가이드 + 피드백 기반 품질 점수**로 동작한다 — 비용이 거의 들지 않고, 데이터가 쌓일수록 좋아지며, 나중에 임베딩/파인튜닝으로 교체 가능한 슬롯 구조.

## 데이터 모델 (Supabase)
| 테이블 | 역할 |
|---|---|
| `aj_talk_examples` | 상황 라벨이 붙은 발화 예시. `genre, situation, emotion, trigger_text, utterance, lang, tags[], quality(0~1), approved, source, uses` |
| `aj_talk_rules` | 말하기 규칙/가이드(md). `scope(global/genre/game), genre, game_id, kind(persona/empathy/style/dont/scenario), content, priority, enabled` |
| `aj_talk_sources` | 업로드/연결된 데이터셋(csv/md/transcript/webhook). 건수·상태 |
| `aj_talk_feedback` | 실제 AJ 발화 로그 + 맥락 + 신호(시청자 응답·좋아요·관리자 평가). 학습 루프 입력 |

**상황(situation)**: intro, commentary, reply, agent_reply, event_start, event_score, event_combo, event_fail, event_over, event_level, hype, comfort, tease, ad, greeting, farewell
**감정(emotion)**: excited, calm, empathy, funny, urgent, proud, sad, curious, warm

## 파이프라인 (n8n 식 노드)
```
[소스] CSV 업로드 / MD 가이드 / 인간 BJ 트랜스크립트 / 웹훅(n8n, Zapier) / 직접 입력
   → [라벨링] Haiku 가 상황·감정·트리거 자동 태깅 (트랜스크립트·MD → 예시로 분해)
   → [예시 DB] 승인 → AJ 사용 가능
   → [프롬프트 합성] 런타임: 페르소나 + 게임 컨텍스트 + 규칙(global→genre→game) + 상황·감정 매칭 예시 top-k + 상대 말투 감지(ko/en, 반말/존댓말, 텐션)
   → [AJ 발화] Haiku 스트리밍
   → [피드백] 발화 로그 + 시청자 반응(응답/좋아요/세션) + 관리자 👍👎
   → [학습] 품질 점수 갱신, 고성과 발화를 새 예시 후보로 승격(자동화 스위치 `mlpilot.autoLearn`)
```

## 연결(외부 자동화)
- `POST /api/mlpilot/ingest` (헤더 `x-mlpilot-key`): `{ examples:[...] }` 또는 `{ transcript:[{speaker,text,event?}], genre }` 또는 `{ rule:{...} }`. n8n/Make/Zapier 에서 그대로 호출.
- 키는 관리자 > MLPilot > 연결 에서 발급/재발급 (site_settings.mlpilot_talk.ingestKey).

## 런타임 반영 (`/api/ai-bj/chat`)
- 요청에 `situation`, `event`, `viewerText` 추가 → `buildTalkContext()` 가 규칙·예시를 선택해 system prompt 에 주입. 예시는 `uses` 증가. 샘플링된 발화는 `aj_talk_feedback` 에 기록.

## 관리자 UI (/admin/mlpilot)
탭: 개요(파이프라인·통계) · 예시 데이터 · 규칙/가이드 · 업로드(CSV/MD/트랜스크립트, 템플릿 다운로드) · 연결(웹훅) · 피드백 · 템플릿 매핑(구 v1)

## 비고
- 예시 선택은 v1: 장르·상황·감정 필터 + 품질·최근·랜덤 가중 샘플링(토큰 예산 ~600자). v2 슬롯: pgvector 임베딩 유사도.
- 비용: Haiku 라벨링은 건당 ≈ $0.0003, 1만 건 ≈ $3.
