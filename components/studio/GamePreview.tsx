'use client'

import { useEffect, useRef, useState } from 'react'
import { useNetBridge } from '@/lib/net/useNetBridge'
import { useLang } from '@/lib/i18n/context'
import type { StudioVersionMeta } from '@/lib/supabase/types'
import { prefetchStudyNotes } from '@/components/studio/StudyPanel'

type Viewport = 'pc' | 'tablet' | 'mobile'

// 디바이스별 실제 뷰포트(CSS px). 프레임은 이 크기로 렌더하고, 컨테이너에 안 들어가면 transform 으로 축소해 항상 전부 보이게 한다. 가로 모드는 폭·높이를 바꾼다.
const DEVICE: Record<Exclude<Viewport, 'pc'>, { w: number; h: number; radius: string }> = {
  tablet: { w: 768, h: 1024, radius: 'rounded-2xl' },
  mobile: { w: 390, h: 844, radius: 'rounded-3xl' },
}

const ICON = 'w-4 h-4'
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const VIEWPORT_ICON: Record<Viewport, React.ReactNode> = {
  pc: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="2.5" y="4" width="19" height="13" rx="1.5" /><path d="M9 21h6M12 17v4" /></svg>,
  tablet: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="4.5" y="2.5" width="15" height="19" rx="2" /><path d="M11 18.5h2" /></svg>,
  mobile: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></svg>,
}

export default function GamePreview({
  html, versions, currentVersionId, onSelectVersion, onPublish, busy, onStudy, ajHref, netId, published, liveVersionId, onUpdateLive,
}: {
  published?: boolean
  liveVersionId?: string | null
  onUpdateLive?: (versionId: string) => void | Promise<void>
  html: string | null
  netId?: string | null   // 온라인 브리지용 프로젝트 id (미리보기에서도 멀티플레이 테스트)
  versions: StudioVersionMeta[]
  currentVersionId: string | null
  onSelectVersion: (id: string) => void
  onPublish: () => void
  busy: boolean
  onStudy?: (tab: 'code' | 'scenario') => void
  ajHref?: string | null
}) {
  const [frameKey, setFrameKey] = useState(0)
  useNetBridge(!!html && !!netId, () => null, netId ?? '')
  const [viewport, setViewport] = useState<Viewport>('pc')
  const [landscape, setLandscape] = useState(false)
  // 컨테이너 크기를 재서 기기 프레임 축소 배율 계산
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = boxRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => { const r = e.contentRect; setBox({ w: r.width, h: r.height }) })
    ro.observe(el); return () => ro.disconnect()
  }, [])
  const dev = viewport === 'pc' ? null : DEVICE[viewport]
  const fw = dev ? (landscape ? dev.h : dev.w) : 0, fh = dev ? (landscape ? dev.w : dev.h) : 0
  const scale = dev && box.w > 0 ? Math.min(1, (box.w - 24) / fw, (box.h - 24) / fh) : 1
  const { T } = useLang()
  const s = T.studio
  const publishNode = (
published ? (
          /* 게시된 게임 — 게시 중인 버전 표시. 다른 버전을 보고 있으면 '이 버전 게시' 로 수동 반영 (프롬프트 수정은 자동 반영되지 않음) */
          currentVersionId && liveVersionId && currentVersionId === liveVersionId ? (
            <span className="h-8 inline-flex items-center gap-1.5 rounded-md px-2.5 md:px-3 text-[11.5px] md:text-[12px] font-bold shrink-0 text-[#15803d] bg-[#dcfce7] border border-[#bbf7d0]" title="지금 보고 있는 버전이 게임 페이지에 서빙되는 버전입니다">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />게시 중 v{versions.find(v => v.id === liveVersionId)?.version ?? ''}
            </span>
          ) : (
            <button
              onClick={() => { if (currentVersionId && onUpdateLive) void onUpdateLive(currentVersionId) }}
              disabled={!html || busy || !currentVersionId}
              title={liveVersionId ? `현재 게시본 v${versions.find(v => v.id === liveVersionId)?.version ?? '?'} → 이 버전으로 교체` : '이 버전을 게시본으로 지정'}
              className="h-8 rounded-md px-3 md:px-4 text-[12px] font-bold text-white bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] shadow-[0_2px_8px_rgba(234,88,12,0.3)] transition-all disabled:opacity-40 disabled:shadow-none"
            >
              이 버전 게시{liveVersionId ? <span className="hidden md:inline">{` (현재 v${versions.find(v => v.id === liveVersionId)?.version ?? '?'})`}</span> : null}
            </button>
          )
        ) : (
          <button
            onClick={onPublish}
            disabled={!html || busy}
            className="h-8 rounded-md px-4 text-[12px] font-bold text-white bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] shadow-[0_2px_8px_rgba(37,99,235,0.3)] transition-all disabled:opacity-40 disabled:shadow-none"
          >
            {s.publish}
          </button>
        )
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 md:gap-2 border-b border-[#ebe4d6] px-2 md:px-3 py-2 flex-wrap">
        <button
          onClick={() => setFrameKey(k => k + 1)}
          disabled={!html}
          className="h-8 px-2 md:px-2.5 rounded-md text-[12px] font-semibold text-[#6b6152] hover:text-[#2563eb] hover:bg-[#2563eb]/8 transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0"
          title={s.refresh}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
          <span className="hidden md:inline">{s.refresh}</span>
        </button>
        {versions.length > 0 && (
          <select
            value={currentVersionId ?? ''}
            onChange={e => onSelectVersion(e.target.value)}
            className="h-8 bg-white border border-[#ddd3bf] rounded-md text-[#4a4337] text-[12px] px-2 outline-none flex-1 min-w-0 md:flex-none"
            aria-label={s.versions}
          >
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                {s.versionLabel(v.version)} — {new Date(v.created_at).toLocaleString()}
              </option>
            ))}
          </select>
        )}
        {/* 모바일: 여기서 줄바꿈 → 2번째 줄은 기기·게시 라벨·시나리오/코드·AJ */}
        <span className="basis-full h-0 md:hidden" aria-hidden />
        {/* 디바이스 뷰포트 전환 — PC / 태블릿 / 모바일 */}
        <div className="flex items-center h-8 border border-[#ddd3bf] rounded-md overflow-hidden bg-white shrink-0">
          {(['pc', 'tablet', 'mobile'] as Viewport[]).map(v => (
            <button
              key={v}
              onClick={() => { setViewport(v); setFrameKey(k => k + 1) }}
              disabled={!html}
              aria-label={v}
              title={v.toUpperCase()}
              className={`h-full px-2 md:px-2.5 transition-colors disabled:opacity-40 ${
                viewport === v
                  ? 'bg-[#2563eb]/15 text-[#2563eb]'
                  : 'text-[#857a68] hover:text-[#241f17]'
              }`}
            >
              {VIEWPORT_ICON[v]}
            </button>
          ))}
          {viewport !== 'pc' && (
            <button onClick={() => setLandscape(v => !v)} disabled={!html} aria-label={landscape ? '세로로 보기' : '가로로 보기'} title={landscape ? '세로로 보기' : '가로로 보기'} className={`h-full px-2.5 border-l border-[#ddd3bf] transition-colors ${landscape ? 'bg-[#2563eb]/15 text-[#2563eb]' : 'text-[#857a68] hover:text-[#241f17]'}`}>
              <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M16.5 3.5 20 7l-3.5 3.5" /><path d="M20 7H9a5 5 0 0 0-5 5v1" /><path d="M7.5 20.5 4 17l3.5-3.5" /><path d="M4 17h11a5 5 0 0 0 5-5v-1" /></svg>
            </button>
          )}
        </div>
        <div className="order-none md:order-last contents md:flex md:items-center md:gap-2">{publishNode}</div>
        <div className="flex-1" />
        {/* 학습 노트 — 시나리오 / 코드 (세그먼트) */}
        {onStudy && (
          <div className="flex items-center h-8 border border-[#ddd3bf] rounded-md overflow-hidden bg-white text-[12px] font-semibold">
            <button onClick={() => onStudy('scenario')} onMouseEnter={() => { if (currentVersionId) prefetchStudyNotes(currentVersionId).catch(() => {}) }} disabled={!html || !currentVersionId} title="프롬프트가 어떻게 게임 시나리오가 됐는지" className="h-full px-2.5 md:px-3.5 text-[#4a4337] hover:bg-[#2563eb]/8 hover:text-[#2563eb] transition-colors disabled:opacity-40">시나리오</button>
            <span className="w-px h-4 bg-[#ddd3bf]" />
            <button onClick={() => onStudy('code')} onMouseEnter={() => { if (currentVersionId) prefetchStudyNotes(currentVersionId).catch(() => {}) }} disabled={!html || !currentVersionId} title="코드가 어떻게 짜였는지" className="h-full px-2.5 md:px-3.5 text-[#4a4337] hover:bg-[#2563eb]/8 hover:text-[#2563eb] transition-colors disabled:opacity-40">코드</button>
          </div>
        )}
        {ajHref && (
          <a href={ajHref} target="_blank" rel="noreferrer" title="AJ 대시보드 — 지표·분석·업데이트 제안" className="h-8 px-2.5 md:px-3.5 rounded-md border border-[#ddd3bf] bg-white text-[12px] font-semibold text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors flex items-center gap-1.5 shrink-0">AJ</a>
        )}
      </div>
      <div ref={boxRef} className="flex-1 bg-black min-h-0 relative overflow-hidden">
        {html ? (
          dev && box.w === 0 ? null : dev ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`${dev.radius} border border-[#ddd3bf] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)] bg-black shrink-0`} style={{ width: fw, height: fh, transform: `scale(${scale})`, transformOrigin: 'center', transition: 'width .25s ease, height .25s ease' }}>
                <iframe key={frameKey} sandbox="allow-scripts allow-pointer-lock" srcDoc={html} className="w-full h-full border-0" title="game preview" style={{ width: fw, height: fh }} />
              </div>
              <span className="absolute bottom-2 right-3 text-[10.5px] text-white/50 tabular-nums">{fw}×{fh}{scale < 1 ? ` · ${Math.round(scale * 100)}%` : ''}</span>
            </div>
          ) : (
            <iframe key={frameKey} sandbox="allow-scripts allow-pointer-lock" srcDoc={html} className="absolute inset-0 w-full h-full border-0" title="game preview" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="font-pixel text-[11px] text-[#b3a78f] tracking-widest">{s.emptyPreview}</p>
          </div>
        )}
      </div>
    </div>
  )
}
