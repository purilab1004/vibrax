'use client'
import MascotLoader from '@/components/MascotLoader'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PromptCreditBadge } from '@/components/CurrencyBadge'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { purgeEmptyProjects } from '@/lib/studio/cleanup'
import { useLang } from '@/lib/i18n/context'
import StudioChat, { type ChatMsg } from '@/components/studio/StudioChat'
import GamePreview from '@/components/studio/GamePreview'
import PublishModal from '@/components/studio/PublishModal'
import EditInfoModal from '@/components/studio/EditInfoModal'
import StudyPanel from '@/components/studio/StudyPanel'
import { parseGeneration, hasGenError, hasOffTopic, hasAnswerOnly } from '@/lib/studio/parse'
import { INITIAL_PROMPT_KEY } from '@/lib/studio/constants'
import type { StudioProject, StudioVersionMeta } from '@/lib/supabase/types'
import { loadAvatarConfig } from '@/lib/jeumto/storage'

export default function StudioComposerPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { T } = useLang()
  const s = T.studio

  const [project, setProject] = useState<StudioProject | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [versions, setVersions] = useState<StudioVersionMeta[]>([])
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
  // 좌측 최근 항목 사이드바 접기 (기억)
  const [sideOpen, setSideOpen] = useState(true)
  useEffect(() => { const t = setTimeout(() => { try { if (localStorage.getItem('studio.side') === '0') setSideOpen(false) } catch { /* noop */ } }, 0); return () => clearTimeout(t) }, [])
  useEffect(() => { try { localStorage.setItem('studio.side', sideOpen ? '1' : '0') } catch { /* noop */ } }, [sideOpen])
  const [html, setHtml] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [streaming, setStreaming] = useState<{ description: string; htmlBytes: number; codeTail: string } | null>(null)
  const [usage, setUsage] = useState<{ input: number; output: number; credits?: number; balance?: number } | null>(null)
  const balanceBeforeRef = useRef<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPublish, setShowPublish] = useState(false)
  const loadPublished = async () => {
    const { data } = await supabase.from('games').select('id,live_version_id').eq('studio_project_id', id).maybeSingle()
    const g = data as { id: string; live_version_id?: string | null } | null
    setPublishedGameId(g?.id ?? null); setLiveVersionId(g?.live_version_id ?? null)
  }
  // 선택한 버전을 게시본으로 — 게임 페이지가 즉시 이 버전을 서빙
  const updateLive = async (versionId: string) => {
    if (!publishedGameId) return
    const { error } = await supabase.from('games').update({ live_version_id: versionId } as never).eq('id', publishedGameId)
    if (error) { setError(error.message); return }
    setLiveVersionId(versionId)
  }
  const [showEdit, setShowEdit] = useState(false)
  const [study, setStudy] = useState<'code' | 'scenario' | null>(null) // 학습 노트 패널
  const [aj, setAj] = useState<{ url: string | null; name: string | null }>({ url: null, name: null }) // 채팅의 AJ = 내 점토 아바타
  const [draftPrompt, setDraftPrompt] = useState<string | null>(() => searchParams.get('prompt')) // 학습 노트/AJ 제안 → 채팅 입력에 채우기
  const [publishedGameId, setPublishedGameId] = useState<string | null>(null)
  const [liveVersionId, setLiveVersionId] = useState<string | null>(null)   // 실제 게시(서빙) 중인 버전
  // 보기 모드 — 채팅 전체 / 게임 전체 / 분할(데스크톱). 모바일은 채팅·게임 둘 중 하나만.
  const [view, setView] = useState<'chat' | 'game' | 'split'>('split')
  // 기본값: PC 는 항상 반반, 모바일은 항상 채팅 (세션 안에서 바꾼 건 그대로, 새로 열면 기본값)
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)').matches
    const t = setTimeout(() => setView(mobile ? 'chat' : 'split'), 0)
    return () => clearTimeout(t)
  }, [])
  const pickView = (v: 'chat' | 'game' | 'split') => setView(v)
  const chatCollapsed = view === 'game'
  // 좌측 사이드바 — 최근 프로젝트 (클로드 스타일)
  const [myProjects, setMyProjects] = useState<StudioProject[]>([])
  // 채팅/프리뷰 분할 — 드래그로 조절 (프리뷰 폭 %, 로컬 저장)
  const [previewPct, setPreviewPct] = useState(52)
  const [dragging, setDragging] = useState(false)
  const splitRef = useRef<HTMLDivElement>(null)

  // 빈 프로젝트 정리: 다른 빈 "새 게임"은 진입 시 삭제, 이 프로젝트도 대화 없이 떠나면 삭제
  const messagesRef = useRef<ChatMsg[]>([])
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => {
    let uid: string | null = null
    const mountedAt = Date.now()
    supabase.auth.getUser().then(({ data: { user } }) => { uid = user?.id ?? null; if (uid) purgeEmptyProjects(supabase, uid, id).catch(() => {}) })
    const leave = () => {
      if (!uid || messagesRef.current.length > 0 || Date.now() - mountedAt < 3000) return  // StrictMode 이중 실행/즉시 이탈 보호
      // 서버 기준으로 아직 비어 있으면 삭제 (다른 탭에서 대화했을 수도 있으니 재확인)
      supabase.from('studio_messages').select('id').eq('project_id', id).limit(1).then(({ data }) => { if (!data?.length) supabase.from('studio_projects').delete().eq('id', id).eq('user_id', uid!).then(() => {}) })
    }
    return () => { leave() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  // 게시된 게임 id — AJ 대시보드 링크
  useEffect(() => {
    loadPublished()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
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
    const b = typeof data === 'number' ? data : 0
    setBalance(b)
    return b
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

  const send = async (prompt: string, images?: { media_type: string; data: string; previewUrl: string }[], sounds?: { name: string; media_type: string; data: string; role: string }[], variantSlug?: string, assetIds?: string[], pickedAssets?: { name: string; kind: string; url?: string }[]) => {
    setError(null)
    setMessages(m => [...m, { role: 'user', content: prompt, images: images?.map(i => i.previewUrl), sounds: sounds?.map(x => x.name), assets: pickedAssets }])
    balanceBeforeRef.current = balance
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
          sounds: sounds?.map(x => ({ name: x.name, media_type: x.media_type, data: x.data, role: x.role })),
          variantSlug,
          assetIds,
        }),
      })

      if (res.status === 503) {
        setStreaming(null)
        setMessages(m => m.slice(0, -1))
        const t = await res.text().catch(() => '')
        setError(t.replace(/^paused:\s*/, '') || '지금은 게임 생성이 잠시 중지되어 있어요. 잠시 후 다시 시도해 주세요.')
        return
      }
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
      if (um) {
        // 사용자에겐 LLM 토큰 대신 프롬코인 기준으로 표시 (토큰 사용량은 관리자 TokenPilot 에서)
        const after = await refreshBalance()
        const before = balanceBeforeRef.current
        setUsage({ input: Number(um[1]), output: Number(um[2]), credits: before != null ? Math.max(0, before - after) : undefined, balance: after })
      }
      setStreaming(null)

      if (hasOffTopic(full)) {
        setMessages(m => m.slice(0, -1))
        optimisticPending = false
        setError(s.offTopic)
        return
      }

      if (hasAnswerOnly(full)) {
        // 코드 변경 없이 설명/질문만 한 답변 — 실패가 아니다. 말풍선으로 보여 주고 끝 (크레딧은 서버가 환불)
        const p = parseGeneration(full)
        setMessages(m => [...m, { role: 'assistant', content: p.description }])
        optimisticPending = false
        try { await refreshBalance() } catch { /* noop */ }
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
      // 모델 출력(parsed.html)에는 에셋·플랫폼 브리지가 빠져 있어 그대로 띄우면 배경·캐릭터 이미지가 사라진 것처럼 보인다
      // → 서버가 저장한 버전(에셋 주입·하든 완료)을 불러와 미리보기에 띄운다. 그 전까지만 임시로 모델 출력 표시.
      if (parsed.html) { setHtml(parsed.html); if (view === 'chat') setView('game') }   // 완성되면 게임 화면으로
      // 이 시점에는 서버에 이미 저장 완료 — 후처리 실패해도 롤백하지 않는다
      try {
        const list = await refreshVersions()
        if (list.length > 0) { setCurrentVersionId(list[0].id); await loadVersionHtml(list[0].id) }
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

  if (!project) return <MascotLoader />


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
          <div className="flex items-center rounded-lg border border-[#ddd3bf] bg-white p-0.5" role="tablist" aria-label="보기 모드">
            {([
              ['chat', '채팅', <path key="c" d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />],
              ['split', '반반 (채팅 + 게임)', <g key="s"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16" /></g>],
              ['game', '게임 전체 화면', <g key="g"><rect x="2.5" y="7" width="19" height="11" rx="4" /><path d="M7.5 11v3M6 12.5h3M15 11.5h.01M17.5 13.5h.01" /></g>],
            ] as const).map(([v, l, icon]) => (
              <button key={v} role="tab" aria-selected={view === v} aria-label={l} title={l} onClick={() => pickView(v)}
                className={`w-8 h-7 rounded-md items-center justify-center transition-colors ${v === 'split' ? 'hidden md:flex' : 'flex'} ${view === v ? 'bg-[#241f17] text-white' : 'text-[#8a7f6a] hover:text-[#241f17] hover:bg-[#241f17]/5'}`}>
                <svg viewBox="0 0 24 24" className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
              </button>
            ))}
          </div>
        )}
        <Link href="/credits" className="hover:opacity-80 transition-opacity" title="프롬코인 충전"><PromptCreditBadge amount={balance ?? 0} size="sm" compact /></Link>
      </div>
      <div className="flex-1 flex min-h-0">
        {/* 좌측 — 최근 프로젝트 사이드바 (클로드 스타일, 데스크톱) */}
        {!chatCollapsed && !sideOpen && (
          /* 접힌 사이드바 — 얇은 레일: 펼치기 + 새로 생성 */
          <aside className="hidden lg:flex w-11 shrink-0 flex-col items-center gap-2 border-r border-[#ebe4d6] bg-[#fcfaf5] min-h-0 pt-3">
            <button onClick={() => setSideOpen(true)} aria-label="사이드 메뉴 펼치기" title="최근 항목 펼치기" className="w-8 h-8 rounded-lg text-[#6b6152] hover:text-[#2563eb] hover:bg-[#241f17]/5 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
            <button onClick={createNewProject} aria-label="새로 생성" title="새로 생성" className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white flex items-center justify-center text-sm shadow-sm">＋</button>
          </aside>
        )}
        {!chatCollapsed && sideOpen && (
          <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-[#ebe4d6] bg-[#fcfaf5] min-h-0">
            <div className="mx-3 mt-3 flex items-center gap-1">
              <button
                onClick={createNewProject}
                className="flex-1 flex items-center gap-2 text-[13px] font-semibold text-[#4a4337] hover:text-[#2563eb] px-2.5 py-2 rounded-lg hover:bg-[#241f17]/5 transition-colors text-left"
              >
                <span className="w-5 h-5 rounded-md bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white flex items-center justify-center text-xs" aria-hidden>＋</span>
                새로 생성
              </button>
              <button onClick={() => setSideOpen(false)} aria-label="사이드 메뉴 접기" title="접기" className="w-8 h-8 rounded-lg text-[#9d9280] hover:text-[#2563eb] hover:bg-[#241f17]/5 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
              </button>
            </div>
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
            {view !== 'game' && (
              <div className="relative order-2 md:order-1 h-full flex-1 min-h-0 min-w-0">
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
            {view === 'split' && (
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
            {view !== 'chat' && (
            <div className={`relative order-1 md:order-3 min-h-0 h-full ${view === 'game' ? 'flex-1' : 'md:w-[var(--pw)] shrink-0'} ${dragging ? 'pointer-events-none select-none' : ''}`}>
              <GamePreview
                html={html}
                netId={id}
                published={!!publishedGameId}
                liveVersionId={liveVersionId}
                onUpdateLive={updateLive}
                versions={versions}
                currentVersionId={currentVersionId}
                onSelectVersion={loadVersionHtml}
                onPublish={() => setShowPublish(true)}
                busy={streaming !== null}
                onStudy={(t) => setStudy(t)}
                ajHref={publishedGameId ? `/aj/${publishedGameId}` : null}
              />
            </div>
            )}
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
          versionId={currentVersionId}
          onClose={() => { setShowPublish(false); void loadPublished() }}
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
