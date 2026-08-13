'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import EditInfoModal from '@/components/studio/EditInfoModal'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { StudioProject } from '@/lib/supabase/types'
import { INITIAL_PROMPT_KEY } from '@/lib/studio/constants'

export default function StudioPage() {
  const [projects, setProjects] = useState<StudioProject[] | null>(null)
  const [editing, setEditing] = useState<StudioProject | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [createError, setCreateError] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { T } = useLang()
  const s = T.studio

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/login?redirect=/studio')
        return
      }
      // 첫 진입 보너스(멱등) — 반환값이 현재 잔액.
      // 홈 히어로에서 곧장 넘어온 신규 유저도 보너스를 먼저 받아야 첫 생성이 402가 안 난다.
      const { data: bal, error: bonusError } = await supabase.rpc('grant_signup_bonus' as never)
      if (bonusError) {
        console.error('[studio]', bonusError)
      } else {
        setBalance(typeof bal === 'number' ? bal : 0)
      }
      // 홈 히어로에서 넘어온 첫 프롬프트가 있으면 바로 프로젝트 생성 후 제작 화면으로
      const initialPrompt = sessionStorage.getItem(INITIAL_PROMPT_KEY)
      if (initialPrompt) {
        const { data: proj, error: autoError } = await supabase
          .from('studio_projects')
          .insert([{ user_id: user.id }] as never)
          .select()
          .single()
        if (!autoError && proj) {
          router.replace(`/studio/${(proj as StudioProject).id}`)
          return
        }
        // 실패 시 프롬프트는 storage에 남겨 재시도 가능하게 두고 목록을 계속 로드
        console.error('[studio]', autoError)
        setCreateError(true)
      }
      const { data, error: listError } = await supabase
        .from('studio_projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (listError) {
        console.error('[studio]', listError)
        setLoadError(true)
        setProjects([])
      } else {
        setProjects((data as StudioProject[] | null) ?? [])
      }
    })
  }, [])

  const createProject = async () => {
    if (creating) return
    setCreating(true)
    setCreateError(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?redirect=/studio')
        return
      }
      const { data, error } = await supabase
        .from('studio_projects')
        .insert([{ user_id: user.id }] as never)
        .select()
        .single()
      if (!error && data) {
        router.push(`/studio/${(data as StudioProject).id}`)
      } else {
        console.error('[studio]', error)
        setCreateError(true)
      }
    } finally {
      setCreating(false)
    }
  }

  if (projects === null) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <p className="font-pixel text-[11px] text-[#6b6152] tracking-widest">{s.loading}</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-2 flex-wrap gap-3">
        <h1 className="font-pixel text-[#2563eb] text-sm tracking-widest">{s.heading}</h1>
        <div className="flex items-center gap-4">
          <span className="font-pixel text-[11px] text-[#6b6152] tracking-widest">
            {balance === null ? '—' : s.balance(balance)}
          </span>
          <Link
            href="/credits"
            className="font-pixel text-[11px] tracking-widest text-[#2563eb] border border-[#2563eb] px-3 py-1.5 hover:bg-[#2563eb] hover:text-white transition-colors"
          >
            {T.credits.heading}
          </Link>
        </div>
      </div>
      <p className="text-[#4a4337] text-sm mb-8">{s.subtitle}</p>

      <div className="mb-10">
        <button
          onClick={createProject}
          disabled={creating}
          className="bg-[#2563eb] text-white font-pixel text-[11px] px-6 py-4 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 tracking-widest"
        >
          {s.newProject}
        </button>
        {createError && (
          <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2 mt-3">
            {s.createError}
          </p>
        )}
      </div>

      {loadError ? (
        <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">
          {s.listError}
        </p>
      ) : projects.length === 0 ? (
        <p className="text-[#857a68] text-sm">{s.empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <Link
              key={p.id}
              href={`/studio/${p.id}`}
              className="border border-[#ebe4d6] bg-[#ffffff] p-5 hover:border-[#2563eb] transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[#241f17] text-sm truncate flex-1">{p.title || s.untitled}</h2>
                {/* 제목/훅 문구 수정 */}
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setEditing(p) }}
                  title="게임 정보 수정"
                  className="shrink-0 text-[#9d9280] hover:text-[#2563eb] transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#9d9280]">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
                <span className="font-pixel text-[11px] text-[#857a68] group-hover:text-[#2563eb] tracking-widest transition-colors">
                  {s.openProject}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {editing && (
        <EditInfoModal
          projectId={editing.id}
          initialTitle={editing.title || ''}
          onClose={() => setEditing(null)}
          onSaved={t => setProjects(prev => prev ? prev.map(x => x.id === editing.id ? { ...x, title: t } : x) : prev)}
        />
      )}
    </div>
  )
}
