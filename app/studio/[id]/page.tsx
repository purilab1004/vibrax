'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import StudioChat, { type ChatMsg } from '@/components/studio/StudioChat'
import GamePreview from '@/components/studio/GamePreview'
import PublishModal from '@/components/studio/PublishModal'
import EditInfoModal from '@/components/studio/EditInfoModal'
import StudyPanel from '@/components/studio/StudyPanel'
import { parseGeneration, hasGenError, hasOffTopic } from '@/lib/studio/parse'
import { INITIAL_PROMPT_KEY } from '@/lib/studio/constants'
import type { StudioProject, StudioVersionMeta } from '@/lib/supabase/types'
import { loadAvatarConfig } from '@/lib/jeumto/storage'

export default function StudioComposerPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { T } = useLang()
  const s = T.studio

  const [project, setProject] = useState<StudioProject | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [versions, setVersions] = useState<StudioVersionMeta[]>([])
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [streaming, setStreaming] = useState<{ description: string; htmlBytes: number; codeTail: string } | null>(null)
  const [usage, setUsage] = useState<{ input: number; output: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPublish, setShowPublish] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [study, setStudy] = useState<'code' | 'scenario' | null>(null) // 학습 노트 패널
  const [aj, setAj] = useState<{ url: string | null; name: string | null }>({ url: null, name: null }) // 채팅의 AJ = 내 점토 아바타
  const [draftPrompt, setDraftPrompt] = useState<string | null>(null) // 학습 노트의 '다음 도전' → 채팅 입력에 채우기
  // 채팅 접기/펼치기 — 접으면 프리뷰가 전체를 쓴다
  const [chatCollapsed, setChatCollapsed] = useState(false)
  // 좌측 사이드바 — 최근 프로젝트 (클로드 스타일)
  const [myProjects, setMyProjects] = useState<StudioProject[]>([])
  // 채팅/프리뷰 분할 — 드래그로 조절 (프리뷰 폭 %, 로컬 저장)
  const [previewPct, setPreviewPct] = useState(52)
  const [dragging, setDragging] = useState(false)
  const splitRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const v = localStorage.getItem('studio_preview_pct')
      if (v) setPreviewPct(Math.min(75, Math.max(30, Number(v))))
    } catch {}
  }, [])

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    const container = splitRef.current
    if (!container) return
    setDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      const r = container.getBoundingClientRect()
      const pct = ((r.right - ev.clientX) / r.width) * 100
      setPreviewPct(Math.min(75, Math.max(30, pct)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setPreviewPct(p => {
        try { localStorage.setItem('studio_preview_pct', String(Math.round(p))) } catch {}
        return p
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      sb.from('studio_projects').select('id, user_id, title, created_at')
        .order('created_at', { ascending: false }).limit(30)
        .then(({ data }) => setMyProjects((data as StudioProject[] | null) ?? []))
    })
  }, [id])

  const createNewProject = async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { data } = await sb.from('studio_projects').insert([{ user_id: user.id }] as never).select().single()
    if (data) router.push(`/studio/${(data as StudioProject).id}`)
  }
  // 홈 히어로에서 넘어온 첫 프롬프트 자동 전송은 1회만 (StrictMode 이중 실행 가드)
  const autoSentRef = useRef(false)

  const refreshBalance = async () => {
    const { data } = await supabase.rpc('credit_balance' as never)
    setBalance(typeof data === 'number' ? data : 0)
  }

  const refreshVersions = async () => {
    const { data } = await supabase
      .from('studio_versions')
      .select('id, version, created_at')
      .eq('project_id', id)
      .order('version', { ascending: false })
    const list = (data as StudioVersionMeta[] | null) ?? []
    setVersions(list)
    return list
  }

  const loadVersionHtml = async (versionId: string) => {
    const { data, error } = await supabase
      .from('studio_versions')
      .select('html')
      .eq('id', versionId)
      .single()
    if (error) console.error('[studio]', error)
    if (data) {
      setHtml((data as { html: string }).html)
      setCurrentVersionId(versionId)
    }
  }

  const send = async (prompt: string, images?: { media_type: string; data: string; previewUrl: string }[]) => {
    setError(null)
    setMessages(m => [...m, { role: 'user', content: prompt, images: images?.map(i => i.previewUrl) }])
    // 낙관적 user 메시지가 아직 롤백 대상인지 추적 (성공/GEN_ERROR 처리 후에는 롤백 금지)
    let optimisticPending = true
    setStreaming({ description: '', htmlBytes: 0, codeTail: '' })

    try {
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: id,
          prompt,
          images: images?.map(i => ({ media_type: i.media_type, data: i.data })),
        }),
      })

      if (res.status === 402) {
        setStreaming(null)
        setMessages(m => m.slice(0, -1))
        setError(s.insufficient)
        return
      }
      if (!res.ok || !res.body) {
        setStreaming(null)
        setMessages(m => m.slice(0, -1))
        setError(s.requestError)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        const p = parseGeneration(full)
        // 코드가 실제로 짜이는 모습을 보여주기 위한 스트림 꼬리 (마지막 ~600자)
        const gameIdx = full.indexOf('<game>')
        const codeTail = gameIdx >= 0 ? full.slice(Math.max(gameIdx + 6, full.length - 600)) : ''
        setStreaming({ description: p.description, htmlBytes: p.htmlBytes, codeTail })
      }
      full += decoder.decode()
      // 서버가 붙여준 실제 토큰 사용량 마커 파싱
      const um = full.match(/\[\[USAGE:(\d+):(\d+)\]\]/)
      if (um) setUsage({ input: Number(um[1]), output: Number(um[2]) })
      setStreaming(null)

      if (hasOffTopic(full)) {
        setMessages(m => m.slice(0, -1))
        optimisticPending = false
        setError(s.offTopic)
        return
      }

      if (hasGenError(full)) {
        setMessages(m => m.slice(0, -1))
        optimisticPending = false
        setError(s.genError)
        try {
          await refreshBalance()
        } catch (e) {
          console.error('[studio]', e)
        }
        return
      }

      const parsed = parseGeneration(full)
      setMessages(m => [...m, { role: 'assistant', content: parsed.description }])
      optimisticPending = false
      if (parsed.html) setHtml(parsed.html)
      // 이 시점에는 서버에 이미 저장 완료 — 후처리 실패해도 롤백하지 않는다
      try {
        const list = await refreshVersions()
        if (list.length > 0) setCurrentVersionId(list[0].id)
        await refreshBalance()
        // 첫 생성이면 서버가 제목을 갱신했을 수 있음
        const { data: proj } = await supabase
          .from('studio_projects').select('*').eq('id', id).maybeSingle()
        if (proj) setProject(proj as StudioProject)
      } catch (e) {
        console.error('[studio]', e)
      }
    } catch (e) {
      console.error('[studio]', e)
      setStreaming(null)
      if (optimisticPending) setMessages(m => m.slice(0, -1))
      setError(s.networkError)
      try {
        await refreshBalance()
        await refreshVersions()
        const { data: msgs } = await supabase
          .from('studio_messages')
          .select('role, content')
          .eq('project_id', id)
          .order('created_at', { ascending: true })
        setMessages((msgs as ChatMsg[] | null) ?? [])
      } catch {
        // best-effort resync; ignore
      }
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) loadAvatarConfig(supabase, user.id).then((c) => { if (c) setAj({ url: c.previewUrl, name: c.name }) }).catch(() => {})
      if (!user) {
        router.push(`/login?redirect=/studio/${id}`)
        return
      }
      const { data: proj } = await supabase
        .from('studio_projects').select('*').eq('id', id).maybeSingle()
      if (!proj) {
        router.push('/studio')
        return
      }
      setProject(proj as StudioProject)
      const { data: msgs } = await supabase
        .from('studio_messages')
        .select('role, content')
        .eq('project_id', id)
        .order('created_at', { ascending: true })
      const loadedMsgs = (msgs as ChatMsg[] | null) ?? []
      setMessages(loadedMsgs)
      const list = await refreshVersions()
      if (list.length > 0) await loadVersionHtml(list[0].id)
      await refreshBalance()
      // 홈 히어로에서 넘어온 첫 프롬프트 자동 전송 — 빈 프로젝트에서 1회만.
      // 전송 직전에 storage에서 제거해 새로고침 시 중복 차감을 막는다.
      if (loadedMsgs.length === 0 && !autoSentRef.current) {
        const initialPrompt = sessionStorage.getItem(INITIAL_PROMPT_KEY)
        if (initialPrompt) {
          autoSentRef.current = true
          sessionStorage.removeItem(INITIAL_PROMPT_KEY)
          send(initialPrompt)
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <p className="font-pixel text-[11px] text-[#6b6152] tracking-widest">{s.loading}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: '100svh' }}>
      {/* 상단 바 — 뒤로 · 프로젝트 제목(편집) · 우측: 채팅 토글 / 크레딧 코인 */}
      <div className="flex items-center gap-3 h-12 px-3 border-b border-[#ebe4d6] bg-white/70 backdrop-blur-xl shrink-0">
        <Link
          href="/studio"
          aria-label={s.backToStudio}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[#6b6152] hover:text-[#241f17] hover:bg-[#241f17]/5 transition-colors shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <span className="font-pixel text-[10px] text-[#9d9280] tracking-[0.25em] hidden sm:inline">STUDIO</span>
        <span className="hidden sm:inline text-[#ddd3bf]">/</span>
        <button
          onClick={() => setShowEdit(true)}
          title="제목·훅 문구 수정"
          className="group flex items-center gap-1.5 min-w-0 rounded-md px-2 py-1 hover:bg-[#241f17]/5 transition-colors"
        >
          <span className="text-[14px] font-semibold text-[#241f17] truncate max-w-[40vw]">{project.title}</span>
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#b3a78f] group-hover:text-[#2563eb] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        </button>
        <div className="flex-1" />
        {(html || versions.length > 0) && (
          <button
            onClick={() => setChatCollapsed(v => !v)}
            className="h-8 px-3 rounded-md border border-[#ddd3bf] bg-white text-[12px] font-semibold text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" /></svg>
            {chatCollapsed ? '채팅 펼치기' : '채팅 접기'}
          </button>
        )}
        <Link
          href="/credits"
          className="h-8 flex items-center gap-1.5 rounded-full bg-white border border-[#ebe4d6] shadow-[0_2px_10px_rgba(36,31,23,0.06)] px-3 text-[12px] font-bold text-[#241f17] hover:border-[#2563eb] transition-colors"
        >
          🪙 {s.balance(balance ?? 0)}
        </Link>
      </div>
      <div className="flex-1 flex min-h-0">
        {/* 좌측 — 최근 프로젝트 사이드바 (클로드 스타일, 데스크톱) */}
        {!chatCollapsed && (
          <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-[#ebe4d6] bg-[#fcfaf5] min-h-0">
            <button
              onClick={createNewProject}
              className="mx-3 mt-3 flex items-center gap-2 text-[13px] font-semibold text-[#4a4337] hover:text-[#2563eb] px-2.5 py-2 rounded-lg hover:bg-[#241f17]/5 transition-colors text-left"
            >
              <span className="w-5 h-5 rounded-md bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white flex items-center justify-center text-xs" aria-hidden>＋</span>
              새로 생성
            </button>
            <p className="px-5 mt-4 mb-1.5 font-pixel text-[10px] text-[#9d9280] tracking-widest">최근 항목</p>
            <nav className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-4 space-y-0.5">
              {myProjects.map(p => (
                <Link
                  key={p.id}
                  href={`/studio/${p.id}`}
                  className={`block px-3 py-2 rounded-lg text-[13px] truncate transition-colors ${
                    p.id === id ? 'bg-[#2563eb]/10 text-[#2563eb] font-semibold' : 'text-[#4a4337] hover:bg-[#241f17]/5'
                  }`}
                >
                  {p.title || s.untitled}
                </Link>
              ))}
            </nav>
          </aside>
        )}

        {!html && versions.length === 0 ? (
          /* 아직 게임이 없음 — 채팅이 사이드바를 제외한 전체 폭을 쓴다 */
          <div className="flex-1 min-h-0 flex flex-col min-w-0">
            <StudioChat
              messages={messages}
              streaming={streaming}
              usage={usage}
              error={error}
              onSend={send}
              busy={streaming !== null}
              draft={draftPrompt}
              onDraftConsumed={() => setDraftPrompt(null)}
              ajAvatarUrl={aj.url}
              ajName={aj.name}
            />
          </div>
        ) : (
          /* 게임 생성 후 — 중앙 채팅 / 드래그 리사이저 / 우측 프리뷰 (모바일: 상 프리뷰 / 하 채팅) */
          <div ref={splitRef} className="flex-1 flex flex-col md:flex-row min-h-0" style={{ ['--pw' as string]: `${previewPct}%` }}>
            {!chatCollapsed && (
              <div className="order-2 md:order-1 h-[55%] md:h-full md:flex-1 min-h-0 md:min-w-0">
                <StudioChat
                  messages={messages}
                  streaming={streaming}
                  usage={usage}
                  error={error}
                  onSend={send}
                  busy={streaming !== null}
                  draft={draftPrompt}
                  onDraftConsumed={() => setDraftPrompt(null)}
                  ajAvatarUrl={aj.url}
                  ajName={aj.name}
                />
              </div>
            )}
            {/* 드래그 리사이저 — 잡고 끌면 분할 폭이 바뀐다 */}
            {!chatCollapsed && (
              <div
                onMouseDown={startDrag}
                className={`hidden md:flex order-2 md:order-2 w-2 shrink-0 cursor-col-resize items-center justify-center group/rs ${dragging ? 'bg-[#2563eb]/20' : 'hover:bg-[#2563eb]/10'} transition-colors`}
                role="separator"
                aria-orientation="vertical"
                title="드래그해서 크기 조절"
              >
                <span className={`w-[3px] h-10 rounded-full ${dragging ? 'bg-[#2563eb]' : 'bg-[#ddd3bf] group-hover/rs:bg-[#2563eb]/60'} transition-colors`} />
              </div>
            )}
            <div className={`order-1 md:order-3 min-h-0 border-b md:border-b-0 border-[#ebe4d6] ${chatCollapsed ? 'h-full flex-1' : 'h-[45%] md:h-full md:w-[var(--pw)] shrink-0'} ${dragging ? 'pointer-events-none select-none' : ''}`}>
              <GamePreview
                html={html}
                versions={versions}
                currentVersionId={currentVersionId}
                onSelectVersion={loadVersionHtml}
                onPublish={() => setShowPublish(true)}
                busy={streaming !== null}
                onStudy={(t) => setStudy(t)}
              />
            </div>
          </div>
        )}
      </div>
      {study && html && currentVersionId && (
        <StudyPanel versionId={currentVersionId} html={html} initialTab={study} onClose={() => setStudy(null)} onTryPrompt={(p) => setDraftPrompt(p)} />
      )}
      {showPublish && (
        <PublishModal
          projectId={id}
          defaultTitle={project.title}
          onClose={() => setShowPublish(false)}
        />
      )}
      {showEdit && (
        <EditInfoModal
          projectId={id}
          initialTitle={project.title}
          onClose={() => setShowEdit(false)}
          onSaved={t => setProject(p => (p ? { ...p, title: t } : p))}
        />
      )}
    </div>
  )
}
