-- 학습 노트 캐시 — 버전별 코드/시나리오 설명 JSON. 멱등.
alter table public.studio_versions add column if not exists notes jsonb;
