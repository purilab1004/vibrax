'use client'
// 관리자 UI 공통 조각 — 페이지 헤더 · 카드 · 배지 · 모달 · 버튼 (모던 대시보드 톤)
import { useEffect } from 'react'

export function PageHeader({ title, desc, actions }: { title: string; desc?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-[22px] md:text-[26px] font-extrabold tracking-tight text-[#241f17]">{title}</h1>
        {desc && <div className="text-[13px] text-[#857a68] mt-1">{desc}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#ebe4d6] bg-white shadow-[0_1px_2px_rgba(36,31,23,0.04),0_8px_24px_-16px_rgba(36,31,23,0.18)] ${className}`}>{children}</div>
}

export function Badge({ children, color = '#2563eb', soft = true }: { children: React.ReactNode; color?: string; soft?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap"
      style={soft ? { background: `${color}18`, color, border: `1px solid ${color}33` } : { background: color, color: '#fff' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{children}
    </span>
  )
}

export const btn = {
  primary: 'inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors shadow-[0_2px_8px_rgba(37,99,235,0.25)]',
  ghost: 'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#ddd3bf] bg-white text-[13px] font-medium text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] disabled:opacity-50 transition-colors',
  danger: 'inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#e11d48] text-white text-[13px] font-semibold hover:bg-[#be123c] disabled:opacity-50 transition-colors',
  icon: 'inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#857a68] hover:bg-[#f4efe6] hover:text-[#241f17] transition-colors',
}
export const input = 'w-full h-10 rounded-lg border border-[#ddd3bf] bg-white px-3.5 text-[14px] text-[#241f17] placeholder-[#a1957f] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition'
export const label = 'block text-[12px] font-semibold text-[#6b6152] mb-1.5'

export function Modal({ open, onClose, title, children, width = 'max-w-md' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] bg-[#241f17]/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className={`w-full ${width} bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#ebe4d6] max-h-[92vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ebe4d6] sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-[15px] font-bold text-[#241f17]">{title}</h2>
          <button onClick={onClose} className={btn.icon} aria-label="닫기">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Toast({ msg, kind }: { msg: string | null; kind: 'ok' | 'err' }) {
  if (!msg) return null
  return (
    <div className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[90] rounded-full px-4 py-2 text-[13px] font-semibold shadow-lg ${kind === 'ok' ? 'bg-[#241f17] text-white' : 'bg-[#e11d48] text-white'}`}>{msg}</div>
  )
}

export function Avatar({ url, name, size = 36 }: { url?: string | null; name: string; size?: number }) {
  return (
    <span className="rounded-full overflow-hidden bg-gradient-to-br from-[#e0ecff] to-[#c7f0f7] inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover object-top" />
      ) : <span className="text-[13px] font-bold text-[#2563eb]">{name.charAt(0).toUpperCase()}</span>}
    </span>
  )
}

// ── 추가 조각 ────────────────────────────────────────────────
export const th = 'text-left text-[11.5px] font-semibold text-[#857a68] px-4 py-2.5 bg-[#faf8f3] whitespace-nowrap'
export const td = 'px-4 py-3 text-[13px] text-[#4a4337] align-middle'
export const trHover = 'hover:bg-[#faf8f3] transition-colors'

export function Segmented<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[] }) {
  return (
    <div className="inline-flex items-center rounded-lg bg-[#f1ece2] p-1 gap-0.5">
      {options.map(o => (
        <button key={String(o.value)} onClick={() => onChange(o.value)}
          className={`h-8 px-3 rounded-md text-[12.5px] font-semibold whitespace-nowrap transition-all ${value === o.value ? 'bg-white text-[#241f17] shadow-[0_1px_3px_rgba(36,31,23,0.12)]' : 'text-[#857a68] hover:text-[#241f17]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon = '🗂️', title, desc, action }: { icon?: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="py-14 px-6 text-center">
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-[14px] font-semibold text-[#241f17]">{title}</p>
      {desc && <p className="text-[12.5px] text-[#857a68] mt-1">{desc}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#ebe4d6]">
      <p className="text-[14px] font-bold text-[#241f17]">{children}</p>
      {right && <div className="text-[12px] text-[#857a68] flex items-center gap-2">{right}</div>}
    </div>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, desc, confirmLabel = '삭제', busy }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; desc?: React.ReactNode; confirmLabel?: string; busy?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      {desc && <div className="text-[13.5px] text-[#4a4337]">{desc}</div>}
      <div className="flex justify-end gap-2 pt-5"><button onClick={onClose} className={btn.ghost}>취소</button><button onClick={onConfirm} disabled={busy} className={btn.danger}>{confirmLabel}</button></div>
    </Modal>
  )
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#f1ece2]" style={{ opacity: 1 - i * 0.12 }} />)}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-[#4a4337] cursor-pointer select-none">
      <span role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative inline-flex w-10 h-6 rounded-full transition-colors ${checked ? 'bg-[#2563eb]' : 'bg-[#ddd3bf]'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label && <span>{label}</span>}
    </label>
  )
}
