'use client'
// 스튜디오 채팅 입력창 위 — 관리자만: 생성 엔진 선택(Opus 5·Fable 5.1 = Max 구독 워커, API 토큰) + Max 사용량(5시간·7일, 초기화까지)
import { useEffect, useState } from 'react'
import { ENGINE_LABEL, setEngine, useEngine, type StudioEngine } from '@/lib/studio/engine'

interface Win { utilization?: number; resetsAt?: number }
interface UsageInfo { status?: string; rateLimitType?: string; unifiedWindows?: { five_hour?: Win; seven_day?: Win; seven_day_overage_included?: Win }; model?: string; at?: string; lastError?: string | null }

const left = (sec?: number) => {
  if (!sec) return ''
  const ms = sec * 1000 - Date.now()
  if (ms <= 0) return '곧 초기화'
  const h = Math.floor(ms / 3600000), d = Math.floor(h / 24)
  return d >= 1 ? `${d}일 ${h % 24}시간 뒤 초기화` : h >= 1 ? `${h}시간 ${Math.floor((ms % 3600000) / 60000)}분 뒤 초기화` : `${Math.max(1, Math.floor(ms / 60000))}분 뒤 초기화`
}
const pct = (w?: Win) => (typeof w?.utilization === 'number' ? Math.round(w.utilization * 100) : null)

export default function EngineSelect() {
  const engine = useEngine()
  const [info, setInfo] = useState<{ maxWorker: boolean; usage: { value: UsageInfo; updated_at: string } | null } | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/studio/engine').then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive) setInfo(j) }).catch(() => {})
    load(); const iv = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(iv) }
  }, [])
  if (!info) return null   // 관리자 아님(403) 또는 로딩 중
  const u = info.usage?.value
  const five = u?.unifiedWindows?.five_hour, week = u?.unifiedWindows?.seven_day, extra = u?.unifiedWindows?.seven_day_overage_included
  const fableBlocked = pct(extra) === 100 || /usage_credits|Fable/i.test(u?.lastError ?? '')
  const opts: { v: StudioEngine; note: string; disabled?: boolean }[] = [
    { v: 'max-opus', note: 'Max 구독 · 내 PC 워커', disabled: !info.maxWorker },
    { v: 'max-fable', note: fableBlocked ? '추가 사용량 소진 — 초기화 후 사용' : 'Max 구독 · 내 PC 워커', disabled: !info.maxWorker },
    { v: 'api', note: 'API 크레딧 사용' },
  ]
  const tone = (p: number | null) => (p == null ? 'bg-[#e5e7eb]' : p >= 90 ? 'bg-[#ef4444]' : p >= 70 ? 'bg-[#f59e0b]' : 'bg-[#22c55e]')
  return (
    <div className="mb-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 rounded-xl border border-[#e3ecfb] bg-[#f5f8fe] px-3 py-2 text-left">
        <span className="text-[11px] font-bold text-[#6b7a99] shrink-0">엔진</span>
        <span className="text-[12.5px] font-extrabold text-[#0f1b33] truncate">{ENGINE_LABEL[engine]}</span>
        {engine !== 'api' && (
          <span className="ml-auto flex items-center gap-2 text-[11px] text-[#6b7a99] shrink-0">
            <span className="flex items-center gap-1"><span className="w-10 h-1.5 rounded-full bg-[#e3ecfb] overflow-hidden"><span className={`block h-full ${tone(pct(five))}`} style={{ width: `${pct(five) ?? 0}%` }} /></span>5h {pct(five) ?? '–'}%</span>
            <span className="flex items-center gap-1"><span className="w-10 h-1.5 rounded-full bg-[#e3ecfb] overflow-hidden"><span className={`block h-full ${tone(pct(week))}`} style={{ width: `${pct(week) ?? 0}%` }} /></span>7d {pct(week) ?? '–'}%</span>
          </span>
        )}
        <svg viewBox="0 0 24 24" className={`w-4 h-4 text-[#6b7a99] shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${engine === 'api' ? 'ml-auto' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="mt-1.5 rounded-xl border border-[#e3ecfb] bg-white p-2 space-y-1 shadow-[0_12px_28px_-18px_rgba(37,99,235,0.5)]">
          {opts.map((o) => (
            <button key={o.v} type="button" disabled={o.disabled} onClick={() => { setEngine(o.v); setOpen(false) }} className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left disabled:opacity-40 ${engine === o.v ? 'bg-[#2563eb]/10' : 'hover:bg-[#f5f8fe]'}`}>
              <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${engine === o.v ? 'border-[#2563eb] bg-[#2563eb] shadow-[inset_0_0_0_2px_#fff]' : 'border-[#c9d9f5]'}`} />
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-[#0f1b33]">{ENGINE_LABEL[o.v]}</span>
                <span className={`block text-[11px] ${o.v === 'max-fable' && fableBlocked ? 'text-[#ef4444]' : 'text-[#6b7a99]'}`}>{o.note}</span>
              </span>
            </button>
          ))}
          <div className="border-t border-[#eef3fb] mt-1 pt-2 px-1 space-y-1 text-[11.5px] text-[#4b5b78]">
            <p className="font-bold text-[#0f1b33]">Max 구독 사용량</p>
            {u ? (
              <>
                <p>5시간 창 <b>{pct(five) ?? '–'}%</b> · {left(five?.resetsAt)}</p>
                <p>7일 창 <b>{pct(week) ?? '–'}%</b> · {left(week?.resetsAt)}</p>
                {pct(extra) != null && <p>추가 사용량(Fable 등) <b>{pct(extra)}%</b> · {left(extra?.resetsAt)}</p>}
                <p className="text-[10.5px] text-[#9aa8c2]">마지막 갱신 {info.usage?.updated_at ? new Date(info.usage.updated_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'} (Max 로 생성할 때마다 갱신)</p>
              </>
            ) : <p className="text-[#9aa8c2]">아직 기록이 없어요 — Max 로 한 번 생성하면 표시돼요</p>}
            {!info.maxWorker && <p className="text-[#ef4444]">서버에 MAX_WORKER 가 꺼져 있어 Max 엔진을 쓸 수 없어요</p>}
          </div>
        </div>
      )}
    </div>
  )
}
