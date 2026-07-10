'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import StudioChat, { type ChatMsg } from '@/components/studio/StudioChat'
import GamePreview from '@/components/studio/GamePreview'
import { parseGeneration, hasGenError } from '@/lib/studio/parse'
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
  const [streaming, setStreaming] = useState<{ description: string; htmlBytes: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPublish, setShowPublish] = useState(false)

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
    const { data } = await supabase
      .from('studio_versions')
      .select('html')
      .eq('id', versionId)
      .single()
    if (data) {
      setHtml((data as { html: string }).html)
      setCurrentVersionId(versionId)
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
      setMessages((msgs as ChatMsg[] | null) ?? [])
      const list = await refreshVersions()
      if (list.length > 0) await loadVersionHtml(list[0].id)
      await refreshBalance()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const send = async (prompt: string) => {
    setError(null)
    setMessages(m => [...m, { role: 'user', content: prompt }])
    setStreaming({ description: '', htmlBytes: 0 })

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
      setError(s.genError)
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
      setStreaming({ description: p.description, htmlBytes: p.htmlBytes })
    }
    setStreaming(null)

    if (hasGenError(full)) {
      setError(s.genError)
      await refreshBalance()
      return
    }

    const parsed = parseGeneration(full)
    setMessages(m => [...m, { role: 'assistant', content: parsed.description }])
    if (parsed.html) setHtml(parsed.html)
    const list = await refreshVersions()
    if (list.length > 0) setCurrentVersionId(list[0].id)
    await refreshBalance()
    // 첫 생성이면 서버가 제목을 갱신했을 수 있음
    const { data: proj } = await supabase
      .from('studio_projects').select('*').eq('id', id).maybeSingle()
    if (proj) setProject(proj as StudioProject)
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{s.loading}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div className="flex items-center gap-4 border-b border-gray-800 px-4 py-2 shrink-0">
        <Link
          href="/studio"
          className="font-pixel text-[10px] text-gray-400 hover:text-[#00ff41] tracking-widest transition-colors shrink-0"
        >
          {s.backToStudio}
        </Link>
        <h1 className="text-white text-sm truncate">{project.title}</h1>
        <div className="flex-1" />
        <Link
          href="/credits"
          className="font-pixel text-[10px] text-[#00ff41] tracking-widest shrink-0 hover:underline"
        >
          {s.balance(balance ?? 0)}
        </Link>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[2fr_3fr] min-h-0">
        <StudioChat
          messages={messages}
          streaming={streaming}
          error={error}
          onSend={send}
          busy={streaming !== null}
        />
        <GamePreview
          html={html}
          versions={versions}
          currentVersionId={currentVersionId}
          onSelectVersion={loadVersionHtml}
          onPublish={() => setShowPublish(true)}
          busy={streaming !== null}
        />
      </div>
      {/* PublishModal은 Task 10에서 연결 */}
      {showPublish && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center" onClick={() => setShowPublish(false)}>
          <p className="text-gray-400 text-sm">publish: coming in Task 10</p>
        </div>
      )}
    </div>
  )
}
