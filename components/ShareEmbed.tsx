'use client'
// 게임 공유 + 임베드 — 공유(시스템 공유 시트/링크 복사)와 임베드 코드(반응형·세로·가로 프리셋) 모달.
// 모바일: 하단 시트(큰 터치 타깃, 스크롤), 데스크톱: 가운데 모달. 임베드 페이지는 /embed/{id} (어떤 사이트에서든 iframe 허용).
import { useEffect, useState } from 'react'
import { recordShare } from '@/lib/shares'
import { useLang } from '@/lib/i18n/context'

type Preset = 'responsive' | 'portrait' | 'landscape'
const SITE = 'https://vibrexcup.com'

function embedCode(id: string, title: string, preset: Preset): string {
  const src = `${SITE}/embed/${id}`
  const t = title.replace(/"/g, '&quot;')
  const common = `allow="autoplay; fullscreen; gamepad" allowfullscreen loading="lazy" title="${t}"`
  if (preset === 'responsive') return `<div style="position:relative;width:100%;max-width:800px;aspect-ratio:16/9;margin:0 auto"><iframe src="${src}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px" ${common}></iframe></div>`
  if (preset === 'portrait') return `<iframe src="${src}" width="400" height="711" style="border:0;border-radius:12px;max-width:100%" ${common}></iframe>`
  return `<iframe src="${src}" width="800" height="450" style="border:0;border-radius:12px;max-width:100%" ${common}></iframe>`
}

export default function ShareEmbed({ gameId, title }: { gameId: string; title: string }) {
  const { lang } = useLang()
  const ko = lang !== 'en'
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<Preset>('responsive')
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const [canShare, setCanShare] = useState(false)
  const pageUrl = `${SITE}/games/${gameId}`
  const code = embedCode(gameId, title, preset)

  useEffect(() => { const t = setTimeout(() => setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function'), 0); return () => clearTimeout(t) }, [])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  const copy = async (text: string, what: 'link' | 'code') => {
    try { await navigator.clipboard.writeText(text) } catch {
      // 클립보드 API 가 막힌 경우(비보안 컨텍스트 등) — 임시 textarea 로 복사
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* noop */ }
      ta.remove()
    }
    setCopied(what); setTimeout(() => setCopied(null), 1800)
  }
  const share = async () => {
    recordShare(gameId)
    if (typeof navigator.share === 'function') { try { await navigator.share({ title, url: pageUrl }) } catch { /* 취소 */ } return }
    setOpen(true)
  }
  const openEmbed = () => { recordShare(gameId); setOpen(true) }

  const text = encodeURIComponent(`${title} — Vibrexcup`)
  const url = encodeURIComponent(pageUrl)
  const socials = [
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${text}&url=${url}`, bg: '#000' },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}`, bg: '#1877f2' },
    { name: 'LINE', href: `https://social-plugins.line.me/lineit/share?url=${url}`, bg: '#06c755' },
    { name: 'Telegram', href: `https://t.me/share/url?url=${url}&text=${text}`, bg: '#229ed9' },
    { name: 'Email', href: `mailto:?subject=${text}&body=${url}`, bg: '#6b6152' },
  ]
  const presets: { key: Preset; label: string; sub: string }[] = [
    { key: 'responsive', label: ko ? '반응형' : 'Responsive', sub: '16:9 · 100%' },
    { key: 'portrait', label: ko ? '세로' : 'Portrait', sub: '400×711' },
    { key: 'landscape', label: ko ? '가로' : 'Landscape', sub: '800×450' },
  ]

  return (
    <>
      <button onClick={share} title={ko ? '게임 공유' : 'Share'} className="shrink-0 flex items-center justify-center gap-2 rounded-full font-pixel text-[12px] bg-[#ec4899] text-white px-5 md:px-7 hover:bg-[#db2777] transition-colors whitespace-nowrap tracking-widest shadow-[0_4px_0_#9d174d] active:translate-y-[2px] active:shadow-[0_2px_0_#9d174d] h-12">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
        {ko ? '공유' : 'SHARE'}
      </button>
      <button onClick={openEmbed} aria-label={ko ? '다른 사이트에 임베드' : 'Embed on your site'} title={ko ? '임베드 코드' : 'Embed code'} className="!flex-none shrink-0 h-12 w-12 flex items-center justify-center rounded-full bg-[#241f17] text-white hover:bg-[#3b332a] transition-colors shadow-[0_4px_0_#0d0b08] active:translate-y-[2px] active:shadow-[0_2px_0_#0d0b08]">
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/55 backdrop-blur-[2px]" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div role="dialog" aria-modal="true" aria-label={ko ? '공유 · 임베드' : 'Share · Embed'} className="w-full md:w-[560px] max-h-[88vh] md:max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl md:rounded-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.25)] md:shadow-2xl px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] md:p-6">
            <div className="md:hidden mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#ddd3bf]" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-pixel text-[12px] tracking-widest text-[#241f17]">{ko ? '공유 · 임베드' : 'SHARE · EMBED'}</h2>
              <button onClick={() => setOpen(false)} aria-label={ko ? '닫기' : 'Close'} className="h-9 w-9 rounded-full hover:bg-[#f3eee3] text-[#6b6152] flex items-center justify-center text-lg">✕</button>
            </div>

            {/* 링크 공유 */}
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#9d9280] mb-2">{ko ? '링크' : 'LINK'}</p>
            <div className="flex gap-2 mb-3">
              <input readOnly value={pageUrl} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 h-11 rounded-xl border border-[#e3dccb] bg-[#fcfaf5] px-3 text-[16px] md:text-[13px] text-[#4a4337]" />
              <button onClick={() => copy(pageUrl, 'link')} className="h-11 px-4 rounded-xl bg-[#2563eb] text-white text-[13px] font-bold whitespace-nowrap active:scale-95 transition">{copied === 'link' ? (ko ? '✓ 복사됨' : '✓ Copied') : (ko ? '복사' : 'Copy')}</button>
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {canShare && <button onClick={() => { recordShare(gameId); navigator.share({ title, url: pageUrl }).catch(() => {}) }} className="h-10 px-4 rounded-full bg-[#ec4899] text-white text-[12px] font-bold">{ko ? '📤 공유하기' : '📤 Share…'}</button>}
              {socials.map((s) => (
                <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" onClick={() => recordShare(gameId)} className="h-10 px-4 rounded-full text-white text-[12px] font-bold flex items-center" style={{ background: s.bg }}>{s.name}</a>
              ))}
            </div>

            {/* 임베드 */}
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#9d9280] mb-2">{ko ? '임베드 — 내 사이트·블로그에 붙이기' : 'EMBED — put it on your site'}</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {presets.map((p) => (
                <button key={p.key} onClick={() => setPreset(p.key)} className={`h-14 rounded-xl border text-left px-3 transition ${preset === p.key ? 'border-[#2563eb] bg-[#2563eb]/8 text-[#2563eb]' : 'border-[#e3dccb] text-[#4a4337] hover:border-[#c9bfa8]'}`}>
                  <span className="block text-[13px] font-bold">{p.label}</span>
                  <span className="block text-[11px] opacity-70">{p.sub}</span>
                </button>
              ))}
            </div>
            <div className="relative mb-3">
              <textarea readOnly value={code} rows={4} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-xl border border-[#e3dccb] bg-[#241f17] text-[#d8f3ff] font-mono text-[16px] md:text-[11px] leading-snug md:leading-relaxed p-3 pr-24 md:pr-20 resize-none" />
              <button onClick={() => copy(code, 'code')} className="absolute top-2 right-2 h-9 px-3 rounded-lg bg-[#22d3ee] text-[#062a33] text-[12px] font-extrabold active:scale-95 transition">{copied === 'code' ? (ko ? '✓ 복사됨' : '✓ Copied') : (ko ? '코드 복사' : 'Copy code')}</button>
            </div>
            <div className="flex items-center justify-between gap-3 text-[12px] text-[#857a68]">
              <span>{ko ? '터치 조작·AI 참여·순위는 임베드에서도 그대로 동작합니다.' : 'Touch controls, AI play and rankings work inside the embed too.'}</span>
              <a href={`/embed/${gameId}`} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold text-[#2563eb] hover:underline">{ko ? '미리보기 ↗' : 'Preview ↗'}</a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
