'use client'
// 3D 모델 움직임 — '움직이게 만들기'(자동 리깅) 버튼과 움직임 미리보기 고르기
import { useEffect, useState } from 'react'
import { ui } from './shared'

// 미리보기 동작 — 기본·무기(두 발)·네 발
export const MOTIONS: [string, string][] = [['all', '전체 동작 보기'], ['talk', '말하기'], ['idle', '가만히'], ['walk', '걷기'], ['run', '달리기'], ['jump', '점프'], ['sit', '앉기'], ['strafe_left', '왼쪽 옆걸음'], ['strafe_right', '오른쪽 옆걸음'], ['attack', '공격'], ['happy', '기쁨'], ['hit', '맞기'], ['die', '쓰러지기']]
export const WEAPON_MOTIONS: [string, string][] = [['sword', '칼 들기'], ['slash', '칼 연속 베기'], ['block', '칼·방패 막기'], ['greatsword', '양손검 휘두르기'], ['aim', '총 겨누기'], ['shoot', '총 쏘기'], ['kneel_shoot', '무릎 쏴']]
export const QUAD_MOTIONS: [string, string][] = [['all', '전체 동작 보기'], ['idle', '가만히'], ['walk', '걷기'], ['run', '달리기'], ['jump', '점프'], ['attack', '물기 공격'], ['happy', '기쁨(꼬리)'], ['hit', '맞기'], ['talk', '짖기·말하기'], ['die', '쓰러지기']]

// 카테고리로 나눈 동작 — 전체 보기는 따로 큰 버튼
const GROUPS_BIPED: [string, [string, string][]][] = [
  ['기본', [['idle', '가만히'], ['talk', '말하기'], ['sit', '앉기']]],
  ['이동', [['walk', '걷기'], ['run', '달리기'], ['jump', '점프'], ['strafe_left', '왼쪽 옆걸음'], ['strafe_right', '오른쪽 옆걸음']]],
  ['반응', [['attack', '공격'], ['happy', '기쁨'], ['hit', '맞기'], ['die', '쓰러지기']]],
  ['칼', [['sword', '칼 들기'], ['slash', '연속 베기'], ['block', '칼·방패 막기'], ['greatsword', '양손검']]],
  ['총', [['aim', '겨누기'], ['shoot', '쏘기'], ['kneel_shoot', '무릎 쏴']]],
]
const GROUPS_QUAD: [string, [string, string][]][] = [
  ['기본', [['idle', '가만히'], ['talk', '짖기']]],
  ['이동', [['walk', '걷기'], ['run', '달리기'], ['jump', '점프']]],
  ['반응', [['attack', '물기'], ['happy', '꼬리 흔들기'], ['hit', '맞기'], ['die', '쓰러지기']]],
]
export function MotionChips({ value, onChange, body = 'biped' }: { value: string; onChange: (m: string) => void; body?: string }) {
  const groups = body === 'quad' ? GROUPS_QUAD : GROUPS_BIPED
  const chip = ([v, l]: [string, string]) => (
    <button key={v} type="button" onClick={() => onChange(v)}
      className={`h-7 px-2.5 rounded-[4px] text-[12px] font-semibold border transition-colors ${value === v ? 'bg-[#1f2937] border-[#1f2937] text-white' : 'bg-white border-[#dde3ee] text-[#374151] hover:border-[#93c5fd]'}`}>{l}</button>
  )
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => onChange('all')}
        className={`w-full sm:w-auto h-9 px-4 rounded-[4px] text-[13px] font-bold transition-all ${value === 'all' ? 'bg-gradient-to-r from-[#2563eb] to-[#38bdf8] text-white shadow-[0_8px_22px_-10px_rgba(37,99,235,0.8)]' : 'bg-[#eef4ff] text-[#2563eb] border border-[#bfdbfe] hover:bg-[#e0ebff]'}`}>▶ 전체 동작 차례로 보기</button>
      <div className="grid grid-cols-1 sm:grid-cols-[52px_1fr] gap-x-3 gap-y-1.5 items-start">
        {groups.map(([name, items]) => (
          <div key={name} className="contents">
            <span className="pt-1.5 text-[11px] font-bold text-[#8a93a6]">{name}</span>
            <div className="flex flex-wrap gap-1.5">{items.map(chip)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 드라이브의 GLB 에 뼈대를 넣어 '<이름> (움직임).glb' 로 저장 */
/** face=true 면 이미 움직이는 모델에 눈 깜박·입(말하기) 표정만 넣는다 */
export function RigButton({ driveKey, onDone, face = false }: { driveKey: string; onDone: (f: { key: string; name: string; url: string }) => void; face?: boolean }) {
  const [cost, setCost] = useState<number | null>(null)
  const [job, setJob] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { fetch('/api/designer/rig?info=1').then((r) => r.json()).then((j) => setCost(j.cost ?? null)).catch(() => {}) }, [])
  const start = async () => {
    setErr(null); setJob(0)
    const r = await fetch('/api/designer/rig', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: driveKey, face }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setJob(null); setErr(j.error ?? '요청 실패'); return }
    for (let i = 0; i < 300; i++) {
      await new Promise((ok) => setTimeout(ok, 4000))
      const s = await fetch('/api/designer/rig?token=' + encodeURIComponent(j.token)).then((x) => x.json()).catch(() => null)
      if (!s) continue
      if (s.status === 'done') { setJob(null); if (s.updatedPublished) alert(`갤러리에 공개된 이 모델도 움직이는 버전으로 바꿨어요 (${s.updatedPublished}개) — 이 모델을 쓰는 게임도 이제 움직여요.`); onDone({ key: s.key, name: s.name, url: s.url }); return }
      if (s.status === 'failed') { setJob(null); setErr(s.error); return }
      setJob(s.elapsed ?? 0)
    }
    setJob(null); setErr('시간이 오래 걸리고 있어요. 잠시 후 드라이브를 확인해 주세요.')
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={start} disabled={job !== null} className={ui.primary} title="AI 가 뼈대를 넣어 팔·다리·머리가 움직이게 해요">
        {job !== null ? (face ? `표정 넣는 중… ${job}초` : `뼈대·표정 넣는 중… ${job}초`) : face ? `표정·말하기 넣기${cost ? ` · ${cost} 프롬코인` : ''}` : `움직이게 만들기${cost ? ` · ${cost} 프롬코인` : ''}`}
      </button>
      {err && <span className="text-[12px] text-[#dc2626]">{err}</span>}
    </span>
  )
}
