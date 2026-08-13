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
import { parseGeneration, hasGenError, hasOffTopic } from '@/lib/studio/parse'
import { INITIAL_PROMPT_KEY } from '@/lib/studio/constants'
import type { StudioProject, StudioVersionMeta } from '@/lib/supabase/types'

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

  const send = async (prompt: string) => {
    setError(null)
    setMessages(m => [...m, { role: 'user', content: prompt }])
    // 낙관적 user 메시지가 아직 롤백 대상인지 추적 (성공/GEN_ERROR 처리 후에는 롤백 금지)
    let optimisticPending = true
    setStreaming({ description: '', htmlBytes: 0, codeTail: '' })

    try {
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, prompt }),
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
      {/* 좌측 플로팅 메뉴 버튼과 겹치지 않게 데스크톱은 버튼 폭만큼 들여쓴다 */}
      <div className="flex items-center gap-4 border-b border-[#ebe4d6] px-4 md:pl-36 py-2 shrink-0">
        <Link
          href="/studio"
          className="font-pixel text-[11px] text-[#6b6152] hover:text-[#2563eb] tracking-widest transition-colors shrink-0"
        >
          {s.backToStudio}
        </Link>
        <h1 className="text-[#241f17] text-sm truncate">{project.title}</h1>
        {/* 제목/훅 문구 수정 */}
        <button
          onClick={() => setShowEdit(true)}
          title="게임 정보 수정"
          className="shrink-0 text-[#9d9280] hover:text-[#2563eb] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
        <div className="flex-1" />
        <Link
          href="/credits"
          className="font-pixel text-[11px] text-[#2563eb] tracking-widest shrink-0 hover:underline"
        >
          {s.balance(balance ?? 0)}
        </Link>
      </div>
      {/* 모바일: 상 45% 프리뷰 / 하 55% 채팅, 데스크톱: 좌 채팅 / 우 프리뷰 */}
      <div className="flex-1 grid grid-cols-1 grid-rows-[45%_55%] md:grid-rows-1 md:grid-cols-[2fr_3fr] min-h-0">
        <div className="order-2 md:order-1 min-h-0 h-full">
          <StudioChat
            messages={messages}
            streaming={streaming}
            usage={usage}
            error={error}
            onSend={send}
            busy={streaming !== null}
          />
        </div>
        <div className="order-1 md:order-2 min-h-0 h-full border-b md:border-b-0 border-[#ebe4d6]">
          <GamePreview
            html={html}
            versions={versions}
            currentVersionId={currentVersionId}
            onSelectVersion={loadVersionHtml}
            onPublish={() => setShowPublish(true)}
            busy={streaming !== null}
          />
        </div>
      </div>
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
