'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n/context'
import type { StudioVersionMeta } from '@/lib/supabase/types'
import { prefetchStudyNotes } from '@/components/studio/StudyPanel'

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
  html, versions, currentVersionId, onSelectVersion, onPublish, busy, onStudy, ajHref,
}: {
  html: string | null
  versions: StudioVersionMeta[]
  currentVersionId: string | null
  onSelectVersion: (id: string) => void
  onPublish: () => void
  busy: boolean
  onStudy?: (tab: 'code' | 'scenario') => void
  ajHref?: string | null
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
          className="h-8 px-2.5 rounded-md text-[12px] font-semibold text-[#6b6152] hover:text-[#2563eb] hover:bg-[#2563eb]/8 transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
          {s.refresh}
        </button>
        {versions.length > 0 && (
          <select
            value={currentVersionId ?? ''}
            onChange={e => onSelectVersion(e.target.value)}
            className="h-8 bg-white border border-[#ddd3bf] rounded-md text-[#4a4337] text-[12px] px-2 outline-none"
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
        <div className="flex items-center h-8 border border-[#ddd3bf] rounded-md overflow-hidden bg-white">
          {(['pc', 'tablet', 'mobile'] as Viewport[]).map(v => (
            <button
              key={v}
              onClick={() => { setViewport(v); setFrameKey(k => k + 1) }}
              disabled={!html}
              aria-label={v}
              title={v.toUpperCase()}
              className={`h-full px-2.5 transition-colors disabled:opacity-40 ${
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
        {/* 학습 노트 — 시나리오 / 코드 (세그먼트) */}
        {onStudy && (
          <div className="flex items-center h-8 border border-[#ddd3bf] rounded-md overflow-hidden bg-white text-[12px] font-semibold">
            <button onClick={() => onStudy('scenario')} onMouseEnter={() => { if (currentVersionId) prefetchStudyNotes(currentVersionId).catch(() => {}) }} disabled={!html || !currentVersionId} title="프롬프트가 어떻게 게임 시나리오가 됐는지" className="h-full px-3.5 text-[#4a4337] hover:bg-[#2563eb]/8 hover:text-[#2563eb] transition-colors disabled:opacity-40">시나리오</button>
            <span className="w-px h-4 bg-[#ddd3bf]" />
            <button onClick={() => onStudy('code')} onMouseEnter={() => { if (currentVersionId) prefetchStudyNotes(currentVersionId).catch(() => {}) }} disabled={!html || !currentVersionId} title="코드가 어떻게 짜였는지" className="h-full px-3.5 text-[#4a4337] hover:bg-[#2563eb]/8 hover:text-[#2563eb] transition-colors disabled:opacity-40">코드</button>
          </div>
        )}
        {ajHref && (
          <a href={ajHref} target="_blank" rel="noreferrer" title="AJ 대시보드 — 지표·분석·업데이트 제안" className="h-8 px-3.5 rounded-md border border-[#ddd3bf] bg-white text-[12px] font-semibold text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors flex items-center gap-1.5">🧠 AJ</a>
        )}
        <button
          onClick={onPublish}
          disabled={!html || busy}
          className="h-8 rounded-md px-4 text-[12px] font-bold text-white bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] shadow-[0_2px_8px_rgba(37,99,235,0.3)] transition-all disabled:opacity-40 disabled:shadow-none"
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
