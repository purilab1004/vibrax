'use client'
// 개발 AI 모드 — 첫 생성 전 상세 설정 화면. AI 가 미리 채운 값을 사용자가 바꿀 것만 바꾼다.
import { useState } from 'react'
import { DEV_OPTIONS, DEV_ENGINES, type DevSpec } from '@/lib/studio/dev-spec'

export type DevPlanOption = { id: string; label: string; desc: string; keys: string }

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 items-start py-2.5 border-b border-[#efe8da] last:border-0">
      <div className="pt-1.5"><p className="text-[12.5px] font-bold text-[#241f17]">{label}</p>{hint && <p className="text-[10.5px] text-[#9d9280] mt-0.5 leading-snug">{hint}</p>}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}
function Chip({ on, disabled, onClick, children, badge }: { on: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode; badge?: string }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`h-8 px-3 rounded-full text-[12.5px] font-semibold border transition-colors ${on ? 'bg-[#241f17] text-white border-[#241f17]' : 'bg-white text-[#4a4337] border-[#ddd3bf] hover:border-[#7c3aed] hover:text-[#7c3aed]'} disabled:opacity-45 disabled:hover:border-[#ddd3bf] disabled:hover:text-[#4a4337] disabled:cursor-not-allowed`}>
      {children}{badge && <span className="ml-1 text-[9.5px] font-bold text-[#9d9280]">{badge}</span>}
    </button>
  )
}

export default function DevSpecPanel({ prompt, genre, initial, options, cost, onConfirm, onCancel }: {
  prompt: string; genre: string; initial: DevSpec; options: DevPlanOption[]; cost: number
  onConfirm: (spec: DevSpec) => void; onCancel: () => void
}) {
  const [spec, setSpec] = useState<DevSpec>({ ...initial, control: initial.control ?? (options[0] ? { label: options[0].label, desc: options[0].desc, keys: options[0].keys } : null) })
  const set = <K extends keyof DevSpec>(k: K, v: DevSpec[K]) => setSpec((s) => ({ ...s, [k]: v }))
  return (
    <div className="pt-6 max-w-[560px] mx-auto">
      <div className="rounded-2xl border border-[#d9c8ff] bg-white shadow-[0_10px_40px_rgba(124,58,237,.10)] overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-[#f5f0ff] to-white border-b border-[#efe8da]">
          <p className="text-[10.5px] font-bold tracking-widest text-[#7c3aed]">🛠 개발 AI 모드 · 상세 설정</p>
          <p className="mt-1 text-[14px] font-bold text-[#241f17] leading-snug">“{prompt}”</p>
          <p className="mt-1 text-[12px] text-[#6b6152]"><b className="text-[#7c3aed]">{genre}</b> 게임으로 보고 AI 가 먼저 채워 뒀어요. 바꿀 것만 바꾸세요.</p>
        </div>
        <div className="px-5 py-1">
          <Row label="디자인">{DEV_OPTIONS.dimension.map(([k, l]) => <Chip key={k} on={spec.dimension === k} onClick={() => set('dimension', k)}>{l}</Chip>)}</Row>
          <Row label="개발 타입" hint={spec.engine === 'godot' ? 'Godot 4 프로젝트로 만들어요 — 웹에선 .zip, Vibrex 는 Godot 자동 설치·실행' : spec.engine === 'unity' ? 'Unity 프로젝트(C#)로 만들어요 — 웹에선 .zip, Vibrex 는 설치된 Unity 로 열기 (Unity Hub·로그인 필요)' : '웹에서 바로 플레이·게시'}>{DEV_ENGINES.map(([k, l, ok]) => <Chip key={k} on={spec.engine === k} disabled={!ok} badge={ok ? undefined : '곧'} onClick={ok ? () => set('engine', k as DevSpec['engine']) : undefined}>{l}</Chip>)}</Row>
          <Row label="그래픽">{DEV_OPTIONS.art.map(([k, l]) => <Chip key={k} on={spec.art === k} onClick={() => set('art', k)}>{l}</Chip>)}</Row>
          <Row label="플레이" hint="함께 = 같은 화면 2인부터">{DEV_OPTIONS.online.map(([k, l]) => <Chip key={k} on={spec.online === k} onClick={() => set('online', k)}>{l}</Chip>)}</Row>
          <Row label="스토리">{DEV_OPTIONS.story.map(([k, l]) => <Chip key={String(k)} on={spec.story === k} onClick={() => set('story', k)}>{l}</Chip>)}</Row>
          <Row label="조작">
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {options.map((o, i) => {
                const on = spec.control?.label === o.label
                return (
                  <button key={o.id} type="button" onClick={() => set('control', { label: o.label, desc: o.desc, keys: o.keys })}
                    className={`text-left rounded-xl border px-3 py-2 transition-colors ${on ? 'border-[#7c3aed] bg-[#f7f2ff]' : 'border-[#ddd3bf] bg-white hover:border-[#7c3aed]'}`}>
                    <p className="text-[12.5px] font-bold text-[#241f17]">{o.label}{i === 0 && <span className="ml-1.5 text-[9.5px] font-bold text-[#7c3aed] bg-[#7c3aed]/10 px-1.5 py-0.5 rounded-full">추천</span>}</p>
                    <p className="text-[11px] text-[#6b6152] mt-0.5">🎮 {o.keys}</p>
                  </button>
                )
              })}
            </div>
          </Row>
          <Row label="기기">{DEV_OPTIONS.device.map(([k, l]) => <Chip key={k} on={spec.device === k} onClick={() => set('device', k)}>{l}</Chip>)}</Row>
          <Row label="난이도">{DEV_OPTIONS.difficulty.map(([k, l]) => <Chip key={k} on={spec.difficulty === k} onClick={() => set('difficulty', k)}>{l}</Chip>)}</Row>
          <Row label="목표" hint="이기는 조건">
            <input value={spec.goal} onChange={(e) => set('goal', e.target.value.slice(0, 120))} placeholder="비우면 AI 가 정해요 — 예) 보스 3마리를 쓰러뜨리면 클리어"
              className="w-full h-9 rounded-lg border border-[#ddd3bf] px-3 text-[12.5px] outline-none focus:border-[#7c3aed]" />
          </Row>
        </div>
        <div className="flex items-center gap-2 px-5 py-3.5 bg-[#faf8f3] border-t border-[#efe8da]">
          <button type="button" onClick={onCancel} className="h-10 px-4 rounded-xl text-[12.5px] font-semibold text-[#6b6152] hover:text-[#241f17]">취소</button>
          <button type="button" onClick={() => onConfirm(spec)} className="ml-auto h-10 px-5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#2563eb] text-white text-[13px] font-bold hover:opacity-90">이 설정으로 만들기 · {cost} 프롬코인</button>
        </div>
      </div>
    </div>
  )
}
