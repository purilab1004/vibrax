'use client'
// 게임 저장 슬롯 UI — 시작할 때 고르는 창(이어하기 / 처음부터)과 💾 버튼으로 여는 슬롯 패널. 슬롯은 게임마다 최대 3칸.
import { useState } from 'react'
import type { SlotNo, SlotSummary } from '@/lib/game-saves'

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (!Number.isFinite(s) || s < 0) return ''
  if (s < 60) return '방금 전'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

function SlotCard({ n, s, current, children, onClick }: { n: SlotNo; s: SlotSummary | null; current?: boolean; children?: React.ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-[15px] font-black ${s ? 'bg-[#1d1d1f] text-white' : 'bg-[#f1ede4] text-[#b3aa98]'}`}>{n}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[14px] font-bold text-[#1d1d1f] truncate">
          {s ? (s.label ?? `저장 ${n}`) : '비어 있음'}
          {current && <span className="ml-1.5 align-middle rounded-full bg-[#e8f5ec] text-[#1f8a4c] text-[10px] font-bold px-1.5 py-0.5">플레이 중</span>}
        </span>
        <span className="block text-[12px] text-[#8a8170]">{s ? ago(s.at) : '여기에 새로 저장할 수 있어요'}</span>
      </span>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 rounded-2xl border border-[#ebe4d6] bg-white px-3 py-2.5 hover:border-[#1d1d1f] hover:shadow-sm transition">
      {body}{children}
    </button>
  ) : (
    <div className="w-full flex items-center gap-3 rounded-2xl border border-[#ebe4d6] bg-white px-3 py-2.5">{body}{children}</div>
  )
}

/** 시작할 때 — 저장이 있으면 어느 슬롯으로 이어할지, 아니면 처음부터 */
export function SlotChooser({ slots, onPick }: { slots: (SlotSummary | null)[]; onPick: (c: SlotNo | 'new') => void }) {
  const full = slots.every(Boolean)
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-sm px-4">
      <div className="w-full max-w-[360px] rounded-3xl bg-[#fcfaf5] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <p className="text-[18px] font-black text-[#1d1d1f]">이어서 할까요?</p>
        <p className="mt-1 text-[13px] text-[#8a8170]">저장한 곳에서 시작하거나 처음부터 새로 할 수 있어요.</p>
        <div className="mt-4 flex flex-col gap-2">
          {([1, 2, 3] as SlotNo[]).map((n, i) => slots[i]
            ? <SlotCard key={n} n={n} s={slots[i]} onClick={() => onPick(n)}><span className="shrink-0 rounded-full bg-[#1d1d1f] text-white text-[12px] font-bold px-3 py-1.5">이어하기</span></SlotCard>
            : <SlotCard key={n} n={n} s={null} />)}
        </div>
        <button type="button" onClick={() => onPick('new')}
          className="mt-3 w-full rounded-2xl border-2 border-dashed border-[#d9cfbb] py-3 text-[14px] font-bold text-[#5c5446] hover:border-[#1d1d1f] hover:text-[#1d1d1f] transition">
          처음부터 새로 하기
        </button>
        {full && <p className="mt-2 text-[11.5px] text-[#a0957f] text-center">슬롯 3칸이 모두 찼어요 — 새로 하면 저장할 때 덮어쓸 칸을 골라야 해요.</p>}
      </div>
    </div>
  )
}

/** 💾 버튼 — 어느 슬롯에 저장할지, 슬롯 지우기, 처음부터 다시 */
export function SlotPanel({ slots, current, busy, onSave, onDelete, onRestart, onClose, message }: {
  slots: (SlotSummary | null)[]; current: SlotNo | null; busy: boolean; message?: string | null
  onSave: (n: SlotNo) => void; onDelete: (n: SlotNo) => void; onRestart: () => void; onClose: () => void
}) {
  const [confirm, setConfirm] = useState<string | null>(null)   // 'save:2' | 'del:2' | 'restart'
  const ask = (k: string, run: () => void) => { if (confirm === k) { setConfirm(null); run() } else setConfirm(k) }
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center md:justify-end bg-black/35 px-3" onClick={onClose}
      style={{ paddingTop: 'calc(3.8rem + var(--vbx-safe-top, 0px))' }}>
      <div className="w-full max-w-[360px] rounded-3xl bg-[#fcfaf5] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-black text-[#1d1d1f]">게임 저장 <span className="text-[12px] font-bold text-[#a0957f]">최대 3칸</span></p>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-full hover:bg-[#f1ede4] text-[#5c5446] text-lg leading-none">×</button>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {([1, 2, 3] as SlotNo[]).map((n, i) => {
            const s = slots[i]
            const saveKey = `save:${n}`, delKey = `del:${n}`
            const overwrite = !!s && current !== n
            return (
              <SlotCard key={n} n={n} s={s} current={current === n}>
                <span className="shrink-0 flex gap-1.5">
                  <button type="button" disabled={busy}
                    onClick={() => (overwrite ? ask(saveKey, () => onSave(n)) : onSave(n))}
                    className={`rounded-full text-[12px] font-bold px-3 py-1.5 transition disabled:opacity-40 ${confirm === saveKey ? 'bg-[#e11d48] text-white' : 'bg-[#1d1d1f] text-white'}`}>
                    {confirm === saveKey ? '덮어쓸까요?' : s ? '저장' : '새로 저장'}
                  </button>
                  {s && (
                    <button type="button" disabled={busy} onClick={() => ask(delKey, () => onDelete(n))}
                      className={`rounded-full text-[12px] font-bold px-2.5 py-1.5 transition disabled:opacity-40 ${confirm === delKey ? 'bg-[#e11d48] text-white' : 'bg-[#f1ede4] text-[#5c5446]'}`}>
                      {confirm === delKey ? '지울까요?' : '삭제'}
                    </button>
                  )}
                </span>
              </SlotCard>
            )
          })}
        </div>
        {message && <p className="mt-2 text-[12.5px] font-semibold text-[#1f8a4c] text-center">{message}</p>}
        <button type="button" onClick={() => ask('restart', onRestart)}
          className={`mt-3 w-full rounded-2xl py-2.5 text-[13.5px] font-bold transition ${confirm === 'restart' ? 'bg-[#e11d48] text-white' : 'bg-[#f1ede4] text-[#5c5446] hover:bg-[#e9e2d4]'}`}>
          {confirm === 'restart' ? '저장 안 한 진행은 사라져요 — 처음부터 시작할까요?' : '처음부터 다시 시작 (리셋)'}
        </button>
      </div>
    </div>
  )
}
