'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n/context'
import type { StudioVersionMeta } from '@/lib/supabase/types'

type Viewport = 'pc' | 'tablet' | 'mobile'

// 디바이스별 프리뷰 사이즈 — 높이는 화면에 맞게 줄어들되 폭은 실제 기기 폭 유지
const VIEWPORT_STYLE: Record<Viewport, string> = {
  pc: 'w-full h-full',
  tablet: 'w-[768px] max-w-full h-full max-h-[1024px] rounded-2xl border border-[#ddd3bf] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)]',
  mobile: 'w-[390px] max-w-full h-full max-h-[844px] rounded-3xl border border-[#ddd3bf] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)]',
}

const ICON = 'w-4 h-4'
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const VIEWPORT_ICON: Record<Viewport, React.ReactNode> = {
  pc: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="2.5" y="4" width="19" height="13" rx="1.5" /><path d="M9 21h6M12 17v4" /></svg>,
  tablet: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="4.5" y="2.5" width="15" height="19" rx="2" /><path d="M11 18.5h2" /></svg>,
  mobile: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></svg>,
}

export default function GamePreview({
  html, versions, currentVersionId, onSelectVersion, onPublish, busy,
}: {
  html: string | null
  versions: StudioVersionMeta[]
  currentVersionId: string | null
  onSelectVersion: (id: string) => void
  onPublish: () => void
  busy: boolean
}) {
  const [frameKey, setFrameKey] = useState(0)
  const [viewport, setViewport] = useState<Viewport>('pc')
  const { T } = useLang()
  const s = T.studio

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-[#ebe4d6] px-3 py-2 flex-wrap">
        <button
          onClick={() => setFrameKey(k => k + 1)}
          disabled={!html}
          className="font-pixel text-[11px] text-[#6b6152] hover:text-[#2563eb] transition-colors disabled:opacity-40 tracking-widest"
        >
          {s.refresh}
        </button>
        {versions.length > 0 && (
          <select
            value={currentVersionId ?? ''}
            onChange={e => onSelectVersion(e.target.value)}
            className="bg-[#ffffff] border border-[#ebe4d6] text-[#4a4337] text-[11px] px-2 py-1 outline-none"
            aria-label={s.versions}
          >
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                {s.versionLabel(v.version)} — {new Date(v.created_at).toLocaleString()}
              </option>
            ))}
          </select>
        )}
        {/* 디바이스 뷰포트 전환 — PC / 태블릿 / 모바일 */}
        <div className="flex items-center border border-[#ebe4d6] rounded-md overflow-hidden">
          {(['pc', 'tablet', 'mobile'] as Viewport[]).map(v => (
            <button
              key={v}
              onClick={() => { setViewport(v); setFrameKey(k => k + 1) }}
              disabled={!html}
              aria-label={v}
              title={v.toUpperCase()}
              className={`px-2.5 py-1.5 transition-colors disabled:opacity-40 ${
                viewport === v
                  ? 'bg-[#2563eb]/15 text-[#2563eb]'
                  : 'text-[#857a68] hover:text-[#241f17]'
              }`}
            >
              {VIEWPORT_ICON[v]}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={onPublish}
          disabled={!html || busy}
          className="bg-[#2563eb] text-white font-pixel text-[11px] px-4 py-1.5 hover:bg-[#1d4ed8] transition-colors disabled:opacity-40 tracking-widest"
        >
          {s.publish}
        </button>
      </div>
      <div className="flex-1 bg-black min-h-0">
        {html ? (
          <div className={`w-full h-full ${viewport === 'pc' ? '' : 'flex items-center justify-center py-4'}`}>
            <div className={VIEWPORT_STYLE[viewport]}>
              <iframe
                key={frameKey}
                sandbox="allow-scripts allow-pointer-lock"
                srcDoc={html}
                className="w-full h-full border-0"
                title="game preview"
              />
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="font-pixel text-[11px] text-[#b3a78f] tracking-widest">{s.emptyPreview}</p>
          </div>
        )}
      </div>
    </div>
  )
}
