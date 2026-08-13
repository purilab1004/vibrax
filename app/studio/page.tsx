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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // 프로젝트별 질문(훅 문구) — 게시된 게임의 teaser 우선, 없으면 프로젝트 저장분
  const [teasers, setTeasers] = useState<Record<string, string | null>>({})

  // 프로젝트 삭제 — 퍼블리싱된 게임이 있으면 게임까지 함께 삭제 (안내 후)
  const deleteProject = async (p: StudioProject) => {
    const { data: game } = await supabase
      .from('games').select('id').eq('studio_project_id', p.id).maybeSingle()
    const msg = game
      ? '퍼블리싱된 게임입니다. 정말 삭제하시겠습니까?\n게시된 게임과 대화·버전 기록이 모두 지워집니다.'
      : '이 프로젝트를 삭제할까요?\n대화와 모든 버전이 함께 삭제됩니다.'
    if (!confirm(msg)) return
    setDeletingId(p.id)
    try {
      if (game) {
        const { error: gameError } = await supabase.from('games').delete().eq('id', (game as { id: string }).id)
        if (gameError) { alert('게시된 게임 삭제 실패: ' + gameError.message); return }
      }
      const { error } = await supabase.from('studio_projects').delete().eq('id', p.id)
      if (error) { alert('삭제 실패: ' + error.message); return }
      setProjects(prev => prev ? prev.filter(x => x.id !== p.id) : prev)
    } finally {
      setDeletingId(null)
    }
  }
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
      // 게시된 게임의 훅 문구 로드 — 프로젝트 자체 저장분과 병합
      if (data && (data as StudioProject[]).length > 0) {
        const rows = data as (StudioProject & { teaser?: string | null })[]
        const map: Record<string, string | null> = {}
        for (const r of rows) map[r.id] = r.teaser ?? null
        const ids = rows.map(r => r.id)
        const { data: gameRows } = await supabase
          .from('games').select('studio_project_id, teaser').in('studio_project_id', ids)
        for (const g of (gameRows as { studio_project_id: string; teaser: string | null }[] | null) ?? []) {
          if (g.teaser) map[g.studio_project_id] = g.teaser
        }
        setTeasers(map)
      }
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
            <div
              key={p.id}
              className="border border-[#ebe4d6] bg-[#ffffff] p-5 hover:border-[#2563eb] transition-colors flex flex-col gap-4"
            >
              <Link href={`/studio/${p.id}`} className="block min-w-0">
                <p className="font-pixel text-[9px] text-[#9d9280] tracking-widest mb-1">제목</p>
                <h2 className="text-[#241f17] text-sm font-semibold truncate">{p.title || s.untitled}</h2>
                <p className="font-pixel text-[9px] text-[#9d9280] tracking-widest mt-2.5 mb-1">질문</p>
                <p className="text-[13px] text-[#2563eb] truncate">
                  {teasers[p.id] ? `❝ ${teasers[p.id]} ❞` : '— 수정에서 추가하세요'}
                </p>
                <span className="block mt-2 text-[11px] text-[#9d9280]">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
              </Link>
              {/* 열기 · 수정 · 삭제 */}
              <div className="flex gap-2">
                <Link
                  href={`/studio/${p.id}`}
                  className="flex-1 text-center font-pixel text-[11px] bg-[#2563eb] text-white py-2.5 hover:bg-[#1d4ed8] transition-colors tracking-widest rounded-lg whitespace-nowrap"
                >
                  프롬프트 하기
                </Link>
                <button
                  onClick={() => setEditing(p)}
                  className="flex-1 font-pixel text-[11px] border border-[#ddd3bf] text-[#6b6152] py-2.5 hover:border-[#2563eb] hover:text-[#2563eb] transition-colors tracking-widest rounded-lg"
                >
                  수정
                </button>
                <button
                  onClick={() => deleteProject(p)}
                  disabled={deletingId === p.id}
                  className="flex-1 font-pixel text-[11px] border border-red-400 text-red-500 py-2.5 hover:bg-red-50 hover:border-red-500 transition-colors tracking-widest rounded-lg disabled:opacity-50"
                >
                  {deletingId === p.id ? '...' : '삭제'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <EditInfoModal
          projectId={editing.id}
          initialTitle={editing.title || ''}
          onClose={() => setEditing(null)}
          onSaved={(t, tz) => {
            setProjects(prev => prev ? prev.map(x => x.id === editing.id ? { ...x, title: t } : x) : prev)
            setTeasers(prev => ({ ...prev, [editing.id]: tz ?? null }))
          }}
        />
      )}
    </div>
  )
}
