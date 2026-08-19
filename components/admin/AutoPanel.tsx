'use client'
// 메뉴별 자동화 패널 — 이 메뉴의 AI 스위치(on/off)·상태등·오류 초기화
import { useCallback, useEffect, useState } from 'react'
import { AutoDot } from '@/components/admin/AutoStatusDot'
import { Toggle, btn } from '@/components/admin/ui'

interface Mod { key: string; menu: string; label: string; desc: string }
export default function AutoPanel({ module }: { module: string }) {
  const [d, setD] = useState<{ flags: Record<string, boolean>; health: Record<string, { state: 'on' | 'off' | 'error'; errors: number; review: number }>; modules: Mod[] } | null>(null)
  const load = useCallback(async () => { const r = await fetch('/api/admin/automation?full=1'); if (r.ok) setD(await r.json()) }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  if (!d) return null
  const mods = d.modules.filter(m => m.key.startsWith(module + '.'))
  if (mods.length === 0) return null
  const h = d.health[module] ?? { state: 'off', errors: 0, review: 0 }
  return (
    <div className={`mb-3 rounded-lg border px-4 py-3 ${h.state === 'error' ? 'border-red-300 bg-red-50' : 'border-[#e3e6ec] bg-white'}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <AutoDot state={h.state} size={10} />
        <p className="text-[12.5px] font-bold text-[#1f2430]">{h.state === 'on' ? 'AI 자동 처리 중' : h.state === 'error' ? `AI 처리 오류 ${h.errors}건` : 'AI 꺼짐 — 사람이 수동 처리'}{h.review ? <span className="ml-2 text-[#f59e0b]">검토 대기 {h.review}</span> : null}</p>
        <div className="ml-auto flex items-center gap-2">
          {(h.state === 'error' || h.review > 0) && <button onClick={async () => { await fetch('/api/admin/automation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resetModule: module }) }); load() }} className={btn.danger + ' !h-7'}>초기화 (오류 확인 처리)</button>}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
        {mods.map(m => <div key={m.key} className="flex items-start gap-2"><Toggle checked={!!d.flags[m.key]} onChange={async v => { await fetch('/api/admin/automation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flags: { [m.key]: v } }) }); load() }} /><span className="text-[12.5px] text-[#1f2430]">{m.label} <span className="text-[#9aa1ad]">· {m.desc}</span></span></div>)}
      </div>
    </div>
  )
}
