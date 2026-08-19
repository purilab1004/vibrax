// 자동화(AI 자동 처리) 스위치 + 처리 내역 로그 — 메뉴별 on/off. on 이면 AI/규칙이 알아서 처리, off 면 사람이 수동 처리.
import { createAdminClient } from '@/lib/supabase/admin'

export const AUTOMATION_MODULES = [
  { key: 'templates.autoApprove', menu: '템플릿', label: '기본 템플릿에 없는 새 게임이 만들어지면 템플릿으로 자동 추가', desc: 'off 면 후보로만 쌓이고 사람이 승인' },
  { key: 'games.autoSpam', menu: '게임 관리', label: '의심스러운 게임(스팸·도박·성인·피싱 링크) AI 판정 후 자동 삭제', desc: 'off 면 의심 게임을 검토 대기로만 표시' },
  { key: 'notices.autoIssue', menu: '공지 관리', label: '장애 감지 시(같은 오류 10분 내 5회) 자동 안내 공지 게시', desc: 'off 면 에러 로그만 쌓임 — 공지는 사람이' },
  { key: 'applications.emailAdmin', menu: '신청 관리', label: '토너먼트·파트너 신청서 접수 시 관리자에게 메일 발송', desc: 'off 면 대시보드 검토 대기로만 표시' },
  { key: 'mlpilot.aiJudge', menu: 'MLPilot', label: 'AI 자동 판단(Haiku)으로 프롬프트→템플릿 매핑', desc: 'off 면 키워드/유사도만 사용' },
  { key: 'mlpilot.autoLearn', menu: 'MLPilot', label: '매핑 성공 시 키워드 자동 학습', desc: 'off 면 관리자가 "학습" 버튼으로만' },
  { key: 'tokenpilot.guard', menu: 'TokenPilot', label: '원가 가드 자동 차단(오토 모드)', desc: 'off 면 매뉴얼 — 관리자가 정지/재개' },
  { key: 'adpilot.autoCreative', menu: 'AdPilot', label: 'AJ 가 캠페인 문구·예산을 자동 제안', desc: 'off 면 광고주가 직접 입력' },
  { key: 'blog.autoPost', menu: '블로그', label: '게임 게시 시 출시 노트 자동 발행', desc: 'off 면 초안으로만 저장' },
  { key: 'aj.autoReport', menu: 'AJ', label: 'AJ 리포트 자동 생성(주 1회, 플레이 있는 게임)', desc: 'off 면 사람이 "분석 실행"' },
  { key: 'payments.autoRevoke', menu: '결제', label: '환불/차지백 시 크레딧 자동 회수', desc: 'off 면 관리자가 확인 후 회수' },
  { key: 'broadcasts.autoOff', menu: '방송', label: '24시간 넘게 켜진 방송 자동 종료', desc: 'off 면 관리자가 수동 종료' },
  { key: 'security.autoBlock', menu: '보안', label: '이상 트래픽 세션 자동 차단(제한)', desc: 'off 면 알림만' },
] as const
export type AutomationKey = typeof AUTOMATION_MODULES[number]['key']
export type AutomationFlags = Record<AutomationKey, boolean>
export const DEFAULT_AUTOMATION: AutomationFlags = { 'templates.autoApprove': false, 'games.autoSpam': true, 'notices.autoIssue': true, 'applications.emailAdmin': true, 'mlpilot.aiJudge': true, 'mlpilot.autoLearn': true, 'tokenpilot.guard': true, 'adpilot.autoCreative': true, 'blog.autoPost': true, 'aj.autoReport': false, 'payments.autoRevoke': true, 'broadcasts.autoOff': false, 'security.autoBlock': false }

let cache: { at: number; v: AutomationFlags } | null = null
export async function loadAutomation(): Promise<AutomationFlags> {
  if (cache && Date.now() - cache.at < 30_000) return cache.v
  try { const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'automation').maybeSingle(); const v = { ...DEFAULT_AUTOMATION, ...(((data as { value?: Partial<AutomationFlags> } | null)?.value) ?? {}) }; cache = { at: Date.now(), v }; return v } catch { return DEFAULT_AUTOMATION }
}
export async function saveAutomation(p: Partial<AutomationFlags>) { const cur = await loadAutomation(); const v = { ...cur, ...p }; await createAdminClient().from('site_settings').upsert({ key: 'automation', value: v, updated_at: new Date().toISOString() } as never); cache = null; return v }
export async function isAuto(key: AutomationKey) { return (await loadAutomation())[key] }

/** AI/규칙이 처리한 내역 기록 — 사람 대시보드에서 확인 */
export async function logAutomation(row: { module: string; action: string; target?: string | null; status?: 'ok' | 'error' | 'needs_review'; detail?: Record<string, unknown> }) {
  try { await createAdminClient().from('automation_logs').insert([{ module: row.module, action: row.action, target: row.target ?? null, status: row.status ?? 'ok', detail: row.detail ?? null }] as never) } catch { /* ignore */ }
}
