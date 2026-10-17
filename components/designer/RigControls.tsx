'use client'
// 3D 모델 움직임 — '🦴 움직이게 만들기'(자동 리깅) 버튼과 움직임 미리보기 고르기
import { useEffect, useState } from 'react'
import { ui } from './shared'

export const MOTIONS: [string, string][] = [['all', '▶ 전체 동작 보기'], ['idle', '가만히'], ['walk', '걷기'], ['run', '달리기'], ['jump', '점프'], ['attack', '공격'], ['happy', '기쁨'], ['hit', '맞기']]

export function MotionChips({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return <div className="flex flex-wrap gap-1.5">{MOTIONS.map(([v, l]) => <button key={v} type="button" onClick={() => onChange(v)} className={ui.chip(value === v)}>{l}</button>)}</div>
}

/** 드라이브의 GLB 에 뼈대를 넣어 '<이름> (움직임).glb' 로 저장 */
export function RigButton({ driveKey, onDone }: { driveKey: string; onDone: (f: { key: string; name: string; url: string }) => void }) {
  const [cost, setCost] = useState<number | null>(null)
  const [job, setJob] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { fetch('/api/designer/rig?info=1').then((r) => r.json()).then((j) => setCost(j.cost ?? null)).catch(() => {}) }, [])
  const start = async () => {
    setErr(null); setJob(0)
    const r = await fetch('/api/designer/rig', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: driveKey }) })
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
        {job !== null ? `🦴 뼈대 넣는 중… ${job}초` : `🦴 움직이게 만들기${cost ? ` · ${cost} 프롬코인` : ''}`}
      </button>
      {err && <span className="text-[12px] text-[#dc2626]">{err}</span>}
    </span>
  )
}
