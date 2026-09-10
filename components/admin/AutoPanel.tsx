'use client'
// 메뉴별 자동화 패널 — 이 메뉴의 AI 스위치(on/off)·상태등·오류 초기화
import { useCallback, useEffect, useState } from 'react'
import { AutoDot } from '@/components/admin/AutoStatusDot'
import { Toggle, btn } from '@/components/admin/ui'

interface Mod { key: string; menu: string; label: string; desc: string }
interface Log { id: string; module: string; action: string; target: string | null; status: 'ok' | 'error' | 'needs_review'; detail: Record<string, unknown> | null; reviewed_at: string | null; created_at: string }
// 검토 사유를 사람이 읽을 수 있게 — detail.error / action 문구를 해석
function explain(l: Log): string {
  const err = String(l.detail?.error ?? '')
  if (/RESEND_API_KEY/.test(err) || /메일 미설정/.test(l.action)) return '관리자 알림 메일이 발송되지 않았어요(메일 서비스 미설정). 신청 내용은 아래 표에서 직접 확인하고, 처리했으면 "확인"을 누르세요.'
  if (/메일 발송 실패/.test(l.action)) return `알림 메일 발송에 실패했어요${err ? ` (${err})` : ''}. 신청 내용은 아래 표에서 확인하세요.`
  if (/확인 필요/.test(l.action)) return '자동 처리가 꺼져 있어 사람이 확인해야 해요. 아래 표에서 내용을 보고 처리했으면 "확인"을 누르세요.'
  return err || '사람이 확인해야 하는 항목이에요.'
}
export default function AutoPanel({ module }: { module: string }) {
  const [d, setD] = useState<{ flags: Record<string, boolean>; health: Record<string, { state: 'on' | 'off' | 'error'; errors: number; review: number }>; modules: Mod[]; logs?: Log[] } | null>(null)
  const load = useCallback(async () => { const r = await fetch('/api/admin/automation?full=1'); if (r.ok) setD(await r.json()) }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  if (!d) return null
  const mods = d.modules.filter(m => m.key.startsWith(module + '.'))
  if (mods.length === 0) return null
  const h = d.health[module] ?? { state: 'off', errors: 0, review: 0 }
  const pending = (d.logs ?? []).filter(l => l.module === module && !l.reviewed_at && (l.status === 'needs_review' || l.status === 'error')).slice(0, 5)
  const review = async (id: string) => { await fetch('/api/admin/automation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewId: id }) }); load() }
  return (
    <div className={`mb-3 rounded-lg border px-4 py-3 ${h.state === 'error' ? 'border-red-300 bg-red-50' : 'border-[#e3e6ec] bg-white'}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <AutoDot state={h.state} size={10} />
        <p className="text-[12.5px] font-bold text-[#1f2430]">{h.state === 'on' ? 'AI 자동 처리 중' : h.state === 'error' ? `AI 처리 오류 ${h.errors}건` : 'AI 꺼짐 — 사람이 수동 처리'}{h.review ? <span className="ml-2 text-[#f59e0b]">검토 대기 {h.review}</span> : null}</p>
        <div className="ml-auto flex items-center gap-2">
          {(h.state === 'error' || h.review > 0) && <button onClick={async () => { await fetch('/api/admin/automation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resetModule: module }) }); load() }} className={btn.danger + ' !h-7'}>초기화 (오류 확인 처리)</button>}
        </div>
      </div>
      {pending.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {pending.map(l => (
            <li key={l.id} className={`flex items-start gap-3 rounded-md border px-3 py-2 ${l.status === 'error' ? 'border-red-200 bg-red-50/60' : 'border-[#fde68a] bg-[#fffbeb]'}`}>
              <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${l.status === 'error' ? 'bg-red-600 text-white' : 'bg-[#f59e0b] text-white'}`}>{l.status === 'error' ? '오류' : '검토'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-[#1f2430] truncate">{l.action}{l.target ? <span className="text-[#6b7280] font-normal"> · {l.target}</span> : null}</p>
                <p className="text-[12px] text-[#4a4337]">{explain(l)}</p>
                <p className="text-[11px] text-[#9aa1ad] mt-0.5">{new Date(l.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => review(l.id)} className={btn.ghost + ' !h-7 shrink-0'}>확인</button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
        {mods.map(m => <div key={m.key} className="flex items-start gap-2"><Toggle checked={!!d.flags[m.key]} onChange={async v => { await fetch('/api/admin/automation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flags: { [m.key]: v } }) }); load() }} /><span className="text-[12.5px] text-[#1f2430]">{m.label} <span className="text-[#9aa1ad]">· {m.desc}</span></span></div>)}
      </div>
    </div>
  )
}
