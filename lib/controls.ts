// lib/controls.ts — 컨트롤러 표준 (모든 게임 공통). 보편 행동 공간(UAS) 채널 ↔ PC 키 / 모바일 버튼 매핑.
// 관리자(/admin/controls)가 site_settings.controls 로 바꿀 수 있고, 게임 HTML 의 KEY_SHIM·TOUCH_SHIM 이 window.VIBREX_CONTROLS(없으면 기본값)로 읽는다.
// 클라이언트·서버 양쪽에서 import 가능 (DB 의존 없음).

export type ControlGroup = 'move' | 'main' | 'item' | 'legacy'
export interface ControlChannel {
  id: string            // UAS 채널 이름 (VIBREX_GAME.inputs 의 키) — 예: jump, fire
  label: string         // 사람이 읽는 이름 — 예: 점프
  desc: string          // 용도 설명
  pc: string[]          // KeyboardEvent.code 목록 — 예: ['Space']
  mobile: 'stick' | 'button' | 'none'   // 모바일 표현: 조이스틱 / 우측 버튼 / 없음
  btnLabel?: string     // 버튼 글자 — 예: JUMP, A
  size?: 'lg' | 'md' | 'sm'
  group: ControlGroup
  enabled: boolean
}

export const DEFAULT_CONTROLS: ControlChannel[] = [
  { id: 'left', label: '왼쪽', desc: '좌 이동·조향', pc: ['ArrowLeft'], mobile: 'stick', group: 'move', enabled: true },
  { id: 'right', label: '오른쪽', desc: '우 이동·조향', pc: ['ArrowRight'], mobile: 'stick', group: 'move', enabled: true },
  { id: 'up', label: '위', desc: '상 이동·가속·회전', pc: ['ArrowUp'], mobile: 'stick', group: 'move', enabled: true },
  { id: 'down', label: '아래 (앉기)', desc: '하 이동·앉기·슬라이드·빠른 낙하', pc: ['ArrowDown'], mobile: 'stick', group: 'move', enabled: true },
  { id: 'jump', label: '점프', desc: '도약·확정 (점프가 없는 게임은 스페이스가 발사)', pc: ['Space'], mobile: 'button', btnLabel: 'JUMP', size: 'lg', group: 'main', enabled: true },
  { id: 'fire', label: '발사·공격', desc: '발사·타격·상호작용', pc: ['KeyA'], mobile: 'button', btnLabel: 'A', size: 'md', group: 'main', enabled: true },
  { id: 'guard', label: '방어·특수', desc: '방어·제동·대시 등 특수 동작', pc: ['KeyS'], mobile: 'button', btnLabel: 'S', size: 'md', group: 'main', enabled: true },
  { id: 'useItem', label: '아이템 사용', desc: '현재 선택된 퀵슬롯 아이템 사용', pc: ['KeyD'], mobile: 'button', btnLabel: 'D', size: 'md', group: 'main', enabled: true },
  { id: 'item1', label: '슬롯 1', desc: '퀵슬롯 1 선택', pc: ['Digit1'], mobile: 'button', btnLabel: '1', size: 'sm', group: 'item', enabled: true },
  { id: 'item2', label: '슬롯 2', desc: '퀵슬롯 2 선택', pc: ['Digit2'], mobile: 'button', btnLabel: '2', size: 'sm', group: 'item', enabled: true },
  { id: 'item3', label: '슬롯 3', desc: '퀵슬롯 3 선택', pc: ['Digit3'], mobile: 'button', btnLabel: '3', size: 'sm', group: 'item', enabled: true },
  { id: 'item4', label: '슬롯 4', desc: '퀵슬롯 4 선택', pc: ['Digit4'], mobile: 'button', btnLabel: '4', size: 'sm', group: 'item', enabled: true },
  // 호환 — 옛 게임이 쓰던 이름. 새 게임은 쓰지 않는다.
  { id: 'action', label: '(구) 액션', desc: '옛 게임의 주 행동 ≈ jump/fire', pc: ['Space'], mobile: 'button', btnLabel: 'A', size: 'lg', group: 'legacy', enabled: true },
  { id: 'action2', label: '(구) 액션2', desc: '옛 게임의 보조 행동 ≈ useItem', pc: ['KeyX'], mobile: 'button', btnLabel: 'B', size: 'md', group: 'legacy', enabled: true },
  { id: 'crouch', label: '(구) 앉기', desc: '옛 게임의 앉기 ≈ down/guard', pc: ['ArrowDown'], mobile: 'none', group: 'legacy', enabled: true },
]

/** 스페이스·↓ 처럼 게임에 해당 채널이 없을 때 대신 보낼 채널 순서 */
export const FALLBACK: Record<string, string[]> = {
  jump: ['fire', 'action'],
  down: ['crouch', 'guard'],
  fire: ['action'],
  guard: ['crouch'],
  useItem: ['action2'],
  action: ['jump', 'fire'],
  action2: ['useItem', 'fire'],
}

/** code → 키 이벤트용 key 문자 (옛 게임이 e.key 로 듣는 경우 대비) */
export function keyOfCode(code: string): string {
  if (code === 'Space') return ' '
  if (code.startsWith('Key')) return code.slice(3).toLowerCase()
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}
export const KEYCODE: Record<string, number> = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, Space: 32, Enter: 13, ShiftLeft: 16, KeyA: 65, KeyB: 66, KeyC: 67, KeyD: 68, KeyE: 69, KeyF: 70, KeyQ: 81, KeyR: 82, KeyS: 83, KeyW: 87, KeyX: 88, KeyZ: 90, Digit1: 49, Digit2: 50, Digit3: 51, Digit4: 52 }

export function sanitizeControls(raw: unknown): ControlChannel[] {
  if (!Array.isArray(raw)) return DEFAULT_CONTROLS
  const out: ControlChannel[] = []
  for (const r of raw as Partial<ControlChannel>[]) {
    if (!r || typeof r.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]{0,23}$/.test(r.id)) continue
    out.push({
      id: r.id, label: String(r.label ?? r.id).slice(0, 30), desc: String(r.desc ?? '').slice(0, 120),
      pc: (Array.isArray(r.pc) ? r.pc : []).filter((c): c is string => typeof c === 'string' && /^[A-Za-z0-9]{1,20}$/.test(c)).slice(0, 3),
      mobile: r.mobile === 'stick' || r.mobile === 'button' || r.mobile === 'none' ? r.mobile : 'none',
      btnLabel: typeof r.btnLabel === 'string' ? r.btnLabel.slice(0, 6) : undefined,
      size: r.size === 'lg' || r.size === 'md' || r.size === 'sm' ? r.size : undefined,
      group: r.group === 'move' || r.group === 'main' || r.group === 'item' || r.group === 'legacy' ? r.group : 'main',
      enabled: r.enabled !== false,
    })
  }
  return out.length ? out : DEFAULT_CONTROLS
}

/** 게임 HTML 에 심을 설정 스크립트 (관리자 설정이 기본값과 다를 때만 필요) */
export function controlsScript(controls: ControlChannel[]): string {
  return `<script>window.VIBREX_CONTROLS=${JSON.stringify(controls).replace(/</g, '\\u003c')};</script>`
}

/** 프롬프트/타이틀 화면용 사람 읽는 요약 */
export function describeControls(controls: ControlChannel[] = DEFAULT_CONTROLS): string {
  const pcName = (c: string) => c === 'Space' ? '스페이스' : c.startsWith('Arrow') ? ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' } as Record<string, string>)[c] : c.replace(/^Key|^Digit/, '')
  return controls.filter(c => c.enabled && c.group !== 'legacy').map(c => `${c.id}=${c.pc.map(pcName).join('/')}${c.mobile === 'button' ? `(모바일 ${c.btnLabel} 버튼)` : c.mobile === 'stick' ? '(모바일 조이스틱)' : ''}`).join(', ')
}
