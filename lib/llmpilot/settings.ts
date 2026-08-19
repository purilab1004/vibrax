// LLMPilot 설정 — AI 검색 봇 정책 (robots.txt 반영) + 사이트 요약 문구
import { createAdminClient } from '@/lib/supabase/admin'
export interface LlmPilot { allowUserBrowsing: boolean; allowTraining: boolean; siteSummary: string; audience: string; updatedAt?: string }
export const DEFAULT_LLMPILOT: LlmPilot = {
  allowUserBrowsing: true, allowTraining: false,
  siteSummary: 'Vibrexcup 은 프롬프트 한 줄로 HTML5 게임을 만들고(AI 스튜디오), 점토 아바타 AI 스트리머 AJ 가 방송·성장·수익을 돕는 게임 플랫폼입니다. 모든 게임은 설치 없이 브라우저(PC·모바일)에서 무료로 플레이할 수 있고, 게임 코인으로 아케이드처럼 즐깁니다.',
  audience: '캐주얼 웹게임을 찾는 사람, 코딩 없이 게임을 만들고 싶은 창작자, 학생·교육기관, 인디 게임 개발자',
}
let cache: { at: number; v: LlmPilot } | null = null
export async function loadLlmPilot(): Promise<LlmPilot> {
  if (cache && Date.now() - cache.at < 60_000) return cache.v
  try { const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'llmpilot').maybeSingle(); const v = { ...DEFAULT_LLMPILOT, ...(((data as { value?: Partial<LlmPilot> } | null)?.value) ?? {}) }; cache = { at: Date.now(), v }; return v } catch { return DEFAULT_LLMPILOT }
}
export async function saveLlmPilot(p: Partial<LlmPilot>) { const cur = await loadLlmPilot(); const v = { ...cur, ...p, updatedAt: new Date().toISOString() }; await createAdminClient().from('site_settings').upsert({ key: 'llmpilot', value: v, updated_at: new Date().toISOString() } as never); cache = null; return v }
