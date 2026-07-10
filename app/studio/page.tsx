'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { StudioProject } from '@/lib/supabase/types'

export default function StudioPage() {
  const [projects, setProjects] = useState<StudioProject[] | null>(null)
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
      // 첫 진입 보너스(멱등) — 반환값이 현재 잔액
      const { data: bal, error: bonusError } = await supabase.rpc('grant_signup_bonus' as never)
      if (bonusError) {
        console.error('[studio]', bonusError)
      } else {
        setBalance(typeof bal === 'number' ? bal : 0)
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
        <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{s.loading}</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-2 flex-wrap gap-3">
        <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest">{s.heading}</h1>
        <div className="flex items-center gap-4">
          <span className="font-pixel text-[10px] text-gray-400 tracking-widest">
            {balance === null ? '—' : s.balance(balance)}
          </span>
          <Link
            href="/credits"
            className="font-pixel text-[10px] tracking-widest text-[#00ff41] border border-[#00ff41] px-3 py-1.5 hover:bg-[#00ff41] hover:text-black transition-colors"
          >
            {T.credits.heading}
          </Link>
        </div>
      </div>
      <p className="text-gray-300 text-sm mb-8">{s.subtitle}</p>

      <div className="mb-10">
        <button
          onClick={createProject}
          disabled={creating}
          className="bg-[#00ff41] text-black font-pixel text-[11px] px-6 py-4 hover:bg-[#00cc33] transition-colors disabled:opacity-50 tracking-widest"
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
        <p className="text-gray-500 text-sm">{s.empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <Link
              key={p.id}
              href={`/studio/${p.id}`}
              className="border border-gray-800 bg-[#111] p-5 hover:border-[#00ff41] transition-colors group"
            >
              <h2 className="text-white text-sm mb-2 truncate">{p.title || s.untitled}</h2>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-600">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
                <span className="font-pixel text-[10px] text-gray-500 group-hover:text-[#00ff41] tracking-widest transition-colors">
                  {s.openProject}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
