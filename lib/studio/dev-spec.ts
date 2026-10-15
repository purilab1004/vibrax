// 개발 AI 모드 — 첫 생성 전에 고르는 상세 설정 (클라이언트·서버 공용, 순수 데이터)
// AI 가 프롬프트를 읽고 먼저 채워 두면 사용자는 바꿀 것만 바꾼다 → 생성 프롬프트에 [개발 설정] 으로 붙는다

export type Dimension = '2d' | '3d'
export type ArtStyle = 'auto' | 'pixel' | 'cartoon' | 'neon' | 'realistic' | 'minimal'
export type Online = 'offline' | 'coop' | 'versus'
export type Device = 'both' | 'pc' | 'mobile'
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface DevSpec {
  dimension: Dimension
  art: ArtStyle
  online: Online
  story: boolean
  device: Device
  difficulty: Difficulty
  goal: string          // 이기는 조건 한 줄 (비우면 AI 가 정함)
  control?: { label: string; desc: string; keys: string } | null
}

export const DEFAULT_DEV_SPEC: DevSpec = { dimension: '2d', art: 'auto', online: 'offline', story: false, device: 'both', difficulty: 'normal', goal: '', control: null }

// 화면 선택지 (첫 항목 = 기본)
export const DEV_OPTIONS = {
  dimension: [['2d', '2D'], ['3d', '3D']] as [Dimension, string][],
  art: [['auto', '알아서'], ['pixel', '픽셀'], ['cartoon', '카툰'], ['neon', '네온'], ['realistic', '사실적'], ['minimal', '미니멀']] as [ArtStyle, string][],
  online: [['offline', '혼자 (오프라인)'], ['coop', '함께 협동'], ['versus', '함께 대결']] as [Online, string][],
  story: [[false, '없음'], [true, '있음']] as [boolean, string][],
  device: [['both', 'PC + 모바일'], ['pc', 'PC'], ['mobile', '모바일']] as [Device, string][],
  difficulty: [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']] as [Difficulty, string][],
}
// 다음 단계에서 열 항목 (지금은 노코드 = 브라우저에서 바로 실행되는 HTML5 게임)
export const DEV_ENGINES = [['nocode', '노코드 (웹)', true], ['godot', 'Godot', false], ['unity', 'Unity', false], ['unreal', 'Unreal', false]] as const

const pick = <T,>(v: unknown, list: [T, string][], d: T): T => (list.some(([k]) => k === v) ? (v as T) : d)
export function sanitizeDevSpec(raw: unknown): DevSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>, D = DEFAULT_DEV_SPEC
  const c = r.control && typeof r.control === 'object' ? r.control as Record<string, unknown> : null
  return {
    dimension: pick(r.dimension, DEV_OPTIONS.dimension, D.dimension),
    art: pick(r.art, DEV_OPTIONS.art, D.art),
    online: pick(r.online, DEV_OPTIONS.online, D.online),
    story: r.story === true,
    device: pick(r.device, DEV_OPTIONS.device, D.device),
    difficulty: pick(r.difficulty, DEV_OPTIONS.difficulty, D.difficulty),
    goal: typeof r.goal === 'string' ? r.goal.trim().slice(0, 120) : '',
    control: c && typeof c.label === 'string' ? { label: String(c.label).slice(0, 24), desc: String(c.desc ?? '').slice(0, 80), keys: String(c.keys ?? '').slice(0, 60) } : null,
  }
}

const label = <T,>(list: [T, string][], v: T) => list.find(([k]) => k === v)?.[1] ?? String(v)

/** 채팅에 남는 한 줄 요약 (이후 수정 때도 대화 기록으로 모델이 본다) */
export function devSpecSummary(s: DevSpec): string {
  return [label(DEV_OPTIONS.dimension, s.dimension), s.art === 'auto' ? null : label(DEV_OPTIONS.art, s.art), label(DEV_OPTIONS.online, s.online), s.story ? '스토리 있음' : '스토리 없음',
    label(DEV_OPTIONS.device, s.device), '난이도 ' + label(DEV_OPTIONS.difficulty, s.difficulty), s.control ? '조작: ' + s.control.label : null, s.goal ? '목표: ' + s.goal : null].filter(Boolean).join(' · ')
}

/** 생성 모델에 붙이는 지시 */
export function devSpecPrompt(s: DevSpec): string {
  const L: string[] = ['[개발 설정 — 사용자가 개발 AI 모드에서 직접 고른 값. 반드시 지킨다]']
  L.push(s.dimension === '3d'
    ? '- 3D 게임으로 만든다: three.js(플랫폼 호스팅 /vendor/three.min.js)로 3D 장면·카메라·조명을 쓰고, 2D 캔버스로 흉내 내지 않는다.'
    : '- 2D 게임으로 만든다(캔버스 2D).')
  const art: Record<ArtStyle, string> = { auto: '', pixel: '도트 픽셀아트(선명한 픽셀, 제한된 팔레트)', cartoon: '밝고 귀여운 카툰 스타일(굵은 외곽선, 둥근 형태)', neon: '어두운 배경의 네온 글로우 스타일', realistic: '사실적인 질감·조명·그림자', minimal: '단색 면과 깔끔한 도형의 미니멀 스타일' }
  if (s.art !== 'auto') L.push(`- 그래픽: ${art[s.art]}.`)
  if (s.online === 'offline') L.push('- 혼자 하는 오프라인 게임.')
  else L.push(`- 여러 명이 ${s.online === 'coop' ? '함께 협동하는' : '서로 대결하는'} 게임으로 설계한다: 같은 화면 2인(1P 방향키+스페이스 · 2P WASD+F)으로 바로 플레이되게 만들고, 1P/2P 를 구분해 표시한다. (온라인 방 연결은 플랫폼이 추후 붙인다)`)
  if (s.story) L.push('- 스토리가 있다: 타이틀에 세계관 한 줄, 시작할 때 짧은 도입(2~4줄 대사/자막), 단계가 오를 때 이야기가 이어지는 한 줄, 클리어 시 엔딩 문구를 넣는다.')
  else L.push('- 스토리 없이 바로 플레이(도입 대사 없음).')
  L.push(s.device === 'pc' ? '- 주 기기: PC(키보드). 모바일도 깨지지 않게만.' : s.device === 'mobile' ? '- 주 기기: 모바일 세로 화면 · 터치 우선(큰 탭 영역, 한 손 조작).' : '- PC 키보드와 모바일 터치 모두 잘 되게.')
  L.push({ easy: '- 난이도 쉬움: 넉넉한 목숨·느린 시작, 처음 하는 사람도 1단계는 깬다.', normal: '- 난이도 보통: 점점 빨라지고 어려워지는 곡선.', hard: '- 난이도 어려움: 빠른 템포·적은 실수 허용, 실력이 필요한 도전.' }[s.difficulty])
  if (s.control) L.push(`- 조작: ${s.control.label} — ${s.control.desc} (키: ${s.control.keys}).`)
  if (s.goal) L.push(`- 이기는 조건(클리어): ${s.goal}`)
  return L.join('\n')
}
