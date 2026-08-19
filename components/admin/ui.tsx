'use client'
// 관리자 UI 공통 조각 — 페이지 헤더 · 카드 · 배지 · 모달 · 버튼 (모던 대시보드 톤)
import { useEffect } from 'react'
import { btn } from '@/components/admin/tokens'

export function PageHeader({ title, desc, actions, badge }: { title: string; desc?: React.ReactNode; actions?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
      <div>
        <h1 className="text-[18px] font-bold tracking-tight text-[#1f2430] flex items-center gap-2">{title}{badge}</h1>
        {desc && <div className="text-[12.5px] text-[#6b7280] mt-0.5">{desc}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-[#e3e6ec] bg-white ${className}`}>{children}</div>
}

export function Badge({ children, color = '#2563eb', soft = true }: { children: React.ReactNode; color?: string; soft?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={soft ? { background: `${color}18`, color, border: `1px solid ${color}33` } : { background: color, color: '#fff' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{children}
    </span>
  )
}

export { btn, input, label } from '@/components/admin/tokens'

export function Modal({ open, onClose, title, children, width = 'max-w-md' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] bg-[#241f17]/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className={`w-full ${width} bg-white rounded-t-xl sm:rounded-lg shadow-2xl border border-[#e3e6ec] max-h-[92vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e3e6ec] sticky top-0 bg-white">
          <h2 className="text-[14px] font-bold text-[#1f2430]">{title}</h2>
          <button onClick={onClose} className={btn.icon} aria-label="닫기">✕</button>
        </div>
        <div className="p-4">{children}</div>
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
export { th, td, trHover } from '@/components/admin/tokens'

export function Segmented<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[] }) {
  return (
    <div className="inline-flex items-center rounded-md border border-[#d9dde5] bg-white p-0.5 gap-0.5">
      {options.map(o => (
        <button key={String(o.value)} onClick={() => onChange(o.value)}
          className={`h-7 px-2.5 rounded text-[12px] font-semibold whitespace-nowrap transition-all ${value === o.value ? 'bg-[#eef2ff] text-[#2563eb]' : 'text-[#6b7280] hover:text-[#1f2430]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, desc, action }: { icon?: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="py-14 px-6 text-center">
      {icon && <p className="text-3xl mb-2">{icon}</p>}
      <p className="text-[14px] font-semibold text-[#1f2430]">{title}</p>
      {desc && <p className="text-[12.5px] text-[#6b7280] mt-1">{desc}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#e3e6ec]">
      <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">{children}</p>
      {right && <div className="text-[12px] text-[#6b7280] flex items-center gap-2">{right}</div>}
    </div>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, desc, confirmLabel = '삭제', busy }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; desc?: React.ReactNode; confirmLabel?: string; busy?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      {desc && <div className="text-[13.5px] text-[#374151]">{desc}</div>}
      <div className="flex justify-end gap-2 pt-5"><button onClick={onClose} className={btn.ghost}>취소</button><button onClick={onConfirm} disabled={busy} className={btn.danger}>{confirmLabel}</button></div>
    </Modal>
  )
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#eef0f4]" style={{ opacity: 1 - i * 0.12 }} />)}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-[#374151] cursor-pointer select-none">
      <span role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative inline-flex w-10 h-6 rounded-full transition-colors ${checked ? 'bg-[#2563eb]' : 'bg-[#ddd3bf]'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label && <span>{label}</span>}
    </label>
  )
}
