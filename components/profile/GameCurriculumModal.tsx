'use client'
// 제작자용 — 내 게임의 AJ 학습 가이드(정석 지식 단계) 관리. 다른 유저의 AI 아바타가 이 단계를 시간차로 하나씩 배운다.
import { useEffect, useState } from 'react'

interface Row { id: string; step_order: number; name: string; hint: string }
export default function GameCurriculumModal({ gameId, title, onClose }: { gameId: string; title: string; onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [name, setName] = useState(''); const [hint, setHint] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  const load = () => fetch(`/api/games/curriculum?gameId=${gameId}`).then(r => r.json()).then(j => setRows(j.rows ?? []))
  useEffect(() => { load() }, [gameId])  // eslint-disable-line react-hooks/exhaustive-deps
  const add = async () => {
    setBusy(true); setErr(null)
    const r = await fetch('/api/games/curriculum', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId, name, hint }) })
    const j = await r.json(); setBusy(false)
    if (!r.ok) { setErr(j.error ?? '실패'); return }
    setName(''); setHint(''); load()
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 md:p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div><p className="font-pixel text-[9px] tracking-[0.3em] text-[#2563eb]">AJ TEACHING GUIDE</p><h3 className="text-[16px] font-bold text-[#241f17] mt-1">AJ 학습 가이드 · {title}</h3></div>
          <button onClick={onClose} className="text-[#9d9280] hover:text-[#241f17] text-lg leading-none">✕</button>
        </div>
        <p className="text-[12px] text-[#857a68] mb-4 leading-relaxed">제작자인 내가 이 게임의 <b>정석 플레이 방법</b>을 단계별로 적어두면, 이 게임을 플레이하는 <b>모든 회원의 AI 아바타</b>가 시간차를 두고 한 단계씩 배워요. (기본 템플릿 기본기 다음에 이어서 학습)</p>
        {rows === null ? <div className="h-16 rounded-lg bg-[#f6f2ea] animate-pulse" /> : rows.length === 0 ? <p className="text-[12.5px] text-[#9d9280] rounded-lg border border-dashed border-[#e6dfd0] px-4 py-4 text-center mb-3">아직 등록한 단계가 없어요.</p> : (
          <ol className="space-y-2 mb-4">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-start gap-2.5 rounded-lg bg-[#faf8f3] px-3 py-2.5">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#241f17] text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                <div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-[#241f17]">{r.name}</p><p className="text-[12px] text-[#6b6152] leading-snug">{r.hint}</p></div>
                <button onClick={async () => { await fetch('/api/games/curriculum', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) }); load() }} className="shrink-0 text-[#9d9280] hover:text-red-500 text-[13px]">✕</button>
              </li>
            ))}
          </ol>
        )}
        <div className="rounded-xl border border-[#ebe4d6] p-3.5 space-y-2.5">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="단계 이름 — 예: 초반엔 왼쪽 라인부터 정리" className="w-full h-10 rounded-lg border border-[#ddd3bf] px-3 text-[13px] focus:outline-none focus:border-[#2563eb]" />
          <textarea value={hint} onChange={e => setHint(e.target.value)} rows={3} placeholder="AI 에게 가르칠 내용 — 예: 적이 3마리 이상 모이면 폭탄을 아끼지 말고 사용해. 보스전 전에는 체력을 꼭 채워둬." className="w-full rounded-lg border border-[#ddd3bf] px-3 py-2 text-[13px] leading-relaxed focus:outline-none focus:border-[#2563eb] resize-y" />
          {err && <p className="text-[12px] text-red-500">{err}</p>}
          <div className="flex justify-end"><button onClick={add} disabled={busy || !name.trim() || !hint.trim()} className="h-9 px-4 rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold disabled:opacity-40">{busy ? '추가 중…' : '단계 추가'}</button></div>
        </div>
      </div>
    </div>
  )
}
