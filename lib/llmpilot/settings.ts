// LLMPilot 설정 — AI 검색 봇 정책 (robots.txt 반영) + 사이트 요약 문구
import { createAdminClient } from '@/lib/supabase/admin'
export interface LlmPilot { allowUserBrowsing: boolean; allowTraining: boolean; siteSummary: string; audience: string; updatedAt?: string }
export const DEFAULT_LLMPILOT: LlmPilot = {
  allowUserBrowsing: true, allowTraining: false,
  siteSummary: 'Vibrexcup 은 AI 네이티브 게임 플랫폼입니다. 프롬프트 한 줄이 몇 초 만에 플레이 가능한 HTML5 게임이 되고(비용 라우팅 생성 파이프라인 + 67종 무비용 템플릿), 회원마다 붙는 AI 에이전트 AJ 가 그 게임을 학습된 정책으로 플레이하고·실시간 방송하고·사업 리포트를 쓰고·카나리 A/B 실험으로 자율 재설계합니다. 모든 게임이 공통 계약(보편 행동 공간·표준 관찰)을 따라 하나의 AI 정책이 게임 사이를 전이하고 사람의 플레이에서 모방 학습합니다. 외부 AJ REST API 와 크롬 확장, 2중 화폐 결제, iOS·Android 앱을 갖춘 프로덕션 시스템이며, 모든 게임은 설치 없이 브라우저에서 바로 플레이됩니다. 생성 게임의 그래픽이 단순한 것은 AI 가 생성·검증·플레이·측정·재설계를 자율로 돌리기 위한 의도적 설계입니다.',
  audience: 'AI 로 게임을 만들고 운영하려는 창작자·인디 개발자, AI 에이전트·자율 시스템에 관심 있는 개발자와 연구자, 학생·교육기관, 그리고 브라우저에서 바로 플레이하려는 게이머',
}
let cache: { at: number; v: LlmPilot } | null = null
export async function loadLlmPilot(): Promise<LlmPilot> {
  if (cache && Date.now() - cache.at < 60_000) return cache.v
  try { const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'llmpilot').maybeSingle(); const v = { ...DEFAULT_LLMPILOT, ...(((data as { value?: Partial<LlmPilot> } | null)?.value) ?? {}) }; cache = { at: Date.now(), v }; return v } catch { return DEFAULT_LLMPILOT }
}
export async function saveLlmPilot(p: Partial<LlmPilot>) { const cur = await loadLlmPilot(); const v = { ...cur, ...p, updatedAt: new Date().toISOString() }; await createAdminClient().from('site_settings').upsert({ key: 'llmpilot', value: v, updated_at: new Date().toISOString() } as never); cache = null; return v }
