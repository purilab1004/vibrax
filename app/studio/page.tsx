'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PromptCreditBadge, PromptCreditIcon } from '@/components/CurrencyBadge'
import EditInfoModal from '@/components/studio/EditInfoModal'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { StudioProject } from '@/lib/supabase/types'
import { INITIAL_PROMPT_KEY } from '@/lib/studio/constants'
import { auroraOf } from '@/components/GameCard'
import { titleFont } from '@/lib/fonts'
import HeroPromptInput from '@/components/HeroPromptInput'

export default function StudioPage() {
  const [projects, setProjects] = useState<StudioProject[] | null>(null)
  const [editing, setEditing] = useState<StudioProject | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // 프로젝트별 질문(훅 문구) — 게시된 게임의 teaser 우선, 없으면 프로젝트 저장분
  const [teasers, setTeasers] = useState<Record<string, string | null>>({})
  // 게시된 게임 (프로젝트 id → 게임) — 카드에 썸네일·게시 상태·플레이 링크
  const [published, setPublished] = useState<Record<string, { id: string; thumbnail_url: string | null; view_count: number | null }>>({})
  const [query, setQuery] = useState('') // 내 프로젝트 검색(제목·훅 문구)

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
          .from('games').select('id, studio_project_id, teaser, thumbnail_url, view_count').in('studio_project_id', ids)
        const pub: Record<string, { id: string; thumbnail_url: string | null; view_count: number | null }> = {}
        for (const g of (gameRows as { id: string; studio_project_id: string; teaser: string | null; thumbnail_url: string | null; view_count: number | null }[] | null) ?? []) {
          if (g.teaser) map[g.studio_project_id] = g.teaser
          pub[g.studio_project_id] = { id: g.id, thumbnail_url: g.thumbnail_url, view_count: g.view_count }
        }
        setTeasers(map)
        setPublished(pub)
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

  const [chooser, setChooser] = useState(false) // 새 게임 추가 — 직접(프롬프트) vs 외부 링크/파일
  const createProject = async (initialPrompt?: string) => {
    if (creating) return
    setCreating(true)
    setCreateError(false)
    try {
      if (initialPrompt?.trim()) { try { sessionStorage.setItem(INITIAL_PROMPT_KEY, initialPrompt.trim()) } catch {} }
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="font-pixel text-[11px] text-[#6b6152] tracking-widest animate-pulse">{s.loading}</p>
      </div>
    )
  }

  const publishedCount = Object.keys(published).length

  return (
    <div className="min-h-[100svh]">
      {/* 상단 바 — 유리 배경, 왼쪽 홈 · 가운데 STUDIO · 오른쪽 크레딧 코인 */}
      <div className="sticky top-0 z-30 flex items-center gap-4 border-b border-[#ebe4d6] bg-white/60 backdrop-blur-xl px-4 h-12">
        <Link href="/" className="font-pixel text-[11px] text-[#6b6152] hover:text-[#2563eb] tracking-widest transition-colors shrink-0">← 홈</Link>
        <span className="font-pixel text-[11px] text-[#2563eb] tracking-widest">{s.heading}</span>
        <div className="flex-1" />
        <Link href="/credits" className="hover:opacity-80 transition-opacity" title="프롬프트 크레딧 충전"><PromptCreditBadge amount={balance} size="sm" /></Link>
      </div>

      {/* 히어로 — 홈 첫 화면과 같은 느낌 (배경 영상 + 헤드라인 + 프롬프트 카드) */}
      <section className="relative overflow-hidden min-h-[78svh] flex flex-col bg-white">
        <video className="absolute inset-0 w-full h-full object-cover opacity-55" autoPlay muted loop playsInline preload="auto" aria-hidden>
          <source src="/hero-bg-2.mp4" type="video/mp4" />
        </video>
        <div className="hero-shield absolute inset-0" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#fcfaf5]" aria-hidden />
        <div className="hero-glow hero-glow-blue" aria-hidden />
        <div className="hero-glow hero-glow-green" aria-hidden />
        <div className="hero-glow hero-glow-yellow" aria-hidden />

        <div className="relative flex-1 w-full max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center py-12">
          <h1 className="hero-chat-in text-3xl md:text-5xl leading-[1.15] tracking-tight font-extrabold text-[#241f17] mb-5">
            {T.hero.promptHeading.split('\n')[0]}
            <br />
            <span className="bg-gradient-to-r from-[#2563eb] to-[#06b6d4] bg-clip-text text-transparent">{T.hero.promptHeading.split('\n')[1]}</span>
          </h1>
          <div className="flex items-center gap-3 mb-9 w-full max-w-md">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#cfc4ab]" />
            <span className="text-[11px] font-semibold tracking-[0.22em] text-[#857a68] whitespace-nowrap">{T.hero.tagline}</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#cfc4ab]" />
          </div>
          <HeroPromptInput onSubmit={(p) => createProject(p)} />
          {createError && <p className="mt-3 text-red-500 text-xs">{s.createError}</p>}
          <p className="mt-5 text-[12px] text-[#857a68]">{T.hero.promptHint}</p>
          {/* 스탯 */}
          <div className="mt-6 flex items-center gap-6 text-[12px] text-[#857a68]">
            <span><b className="text-[#241f17] text-[15px] mr-1">{projects.length}</b>프로젝트</span>
            <span className="w-px h-4 bg-[#ddd3bf]" />
            <span><b className="text-[#241f17] text-[15px] mr-1">{publishedCount}</b>게시됨</span>
            <span className="w-px h-4 bg-[#ddd3bf]" />
            <span className="inline-flex items-center gap-1.5"><PromptCreditIcon className="w-4 h-4" /><b className="text-[#241f17] text-[15px]">{balance ?? '—'}</b>프롬프트 크레딧</span>
          </div>
        </div>
      </section>

      {/* 내 프로젝트 */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 className="font-pixel text-[11px] text-[#6b6152] tracking-widest shrink-0">MY PROJECTS <span className="text-[#2563eb]">({projects.length})</span></h2>
          <div className="flex items-center rounded-full border border-[#ddd3bf] bg-white/95 shadow-[0_2px_10px_rgba(36,31,23,0.06)] focus-within:border-[#2563eb] transition-colors overflow-hidden w-full max-w-xs">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="내 게임 검색…" className="flex-1 min-w-0 bg-transparent px-4 py-2 text-sm text-[#241f17] placeholder-[#a1957f] outline-none" />
            <span className="px-3 text-[#857a68]"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg></span>
          </div>
        </div>

        {loadError ? (
          <p className="text-red-500 text-xs border border-red-200 bg-red-50 px-3 py-2">{s.listError}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {/* 첫 카드 — 새 게임 추가 (+) */}
            <button
              onClick={() => setChooser(true)}
              disabled={creating}
              className="group relative rounded-2xl overflow-hidden border-2 border-dashed border-[#cfc4ab] bg-white/60 hover:border-[#2563eb] hover:bg-white transition-colors flex flex-col items-center justify-center gap-3 min-h-[280px] disabled:opacity-50"
            >
              <span className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563eb] to-[#06b6d4] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(37,99,235,0.35)] group-hover:scale-105 transition-transform">
                <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </span>
              <span className="font-pixel text-[11px] text-[#241f17] tracking-widest">{creating ? '만드는 중…' : '새 게임 추가'}</span>
              <span className="text-[12px] text-[#a1957f] px-6 text-center">프롬프트 제작 · 외부 링크 등록 · 방송 추가</span>
            </button>
            {projects.filter((p) => {
              const q = query.trim().toLowerCase()
              if (!q) return true
              return (p.title || s.untitled).toLowerCase().includes(q) || (teasers[p.id] ?? '').toLowerCase().includes(q)
            }).map((p) => {
              const pub = published[p.id]
              const title = p.title || s.untitled
              return (
                <div key={p.id} className="group relative rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(36,31,23,0.12)] hover:shadow-[0_18px_50px_rgba(36,31,23,0.2)] hover:-translate-y-0.5 transition-all bg-white">
                  {/* 포스터 — 게시된 게임은 썸네일, 아니면 오로라 */}
                  <Link href={`/studio/${p.id}`} className="block relative aspect-[4/3] overflow-hidden" style={auroraOf(p.id)}>
                    {pub?.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pub.thumbnail_url} alt={title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <span className={`absolute top-3 left-3 font-pixel text-[9px] tracking-widest px-2 py-1 rounded-full ${pub ? 'bg-[#22c55e] text-white' : 'bg-white/85 text-[#6b6152]'}`}>
                      {pub ? '● 게시됨' : '작업 중'}
                    </span>
                    {pub && <span className="absolute top-3 right-3 font-pixel text-[9px] tracking-widest px-2 py-1 rounded-full bg-black/45 text-white">👤 {pub.view_count ?? 0}</span>}
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <h3 className={`${titleFont.className} text-white text-[22px] leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] line-clamp-2`}>{title}</h3>
                      <p className="text-[12px] text-white/85 truncate mt-0.5">{teasers[p.id] ? `❝ ${teasers[p.id]} ❞` : '질문(훅 문구)을 수정에서 추가하세요'}</p>
                    </div>
                  </Link>
                  {/* 액션 */}
                  <div className="flex items-center gap-2 p-3">
                    <Link href={`/studio/${p.id}`} className="flex-1 text-center font-pixel text-[11px] bg-[#2563eb] text-white py-2.5 rounded-lg hover:bg-[#1d4ed8] transition-colors tracking-widest">✎ 프롬프트</Link>
                    {pub && <Link href={`/games/${pub.id}`} title="플레이" className="w-10 h-10 rounded-lg border border-[#ddd3bf] text-[#6b6152] hover:border-[#22c55e] hover:text-[#22c55e] flex items-center justify-center">▶</Link>}
                    <button onClick={() => setEditing(p)} title="수정" className="w-10 h-10 rounded-lg border border-[#ddd3bf] text-[#6b6152] hover:border-[#2563eb] hover:text-[#2563eb] flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                    <button onClick={() => deleteProject(p)} disabled={deletingId === p.id} title="삭제" className="w-10 h-10 rounded-lg border border-[#ddd3bf] text-[#6b6152] hover:border-red-400 hover:text-red-500 flex items-center justify-center disabled:opacity-50">
                      {deletingId === p.id ? '…' : (
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                      )}
                    </button>
                  </div>
                  <span className="absolute bottom-[3.4rem] right-3 text-[10px] text-white/70 pointer-events-none">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

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
      {/* 새 게임 추가 — 방식 선택 */}
      {chooser && (
        <div className="fixed inset-0 z-[80] bg-[#241f17]/45 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={() => setChooser(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-[#ebe4d6] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <p className="font-pixel text-[11px] text-[#6b6152] tracking-widest">새 게임 추가</p>
            <h3 className="text-[20px] font-extrabold text-[#241f17] mt-1">무엇을 추가할까요?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              <button onClick={() => { setChooser(false); createProject() }} disabled={creating} className="group text-left rounded-2xl border-2 border-[#2563eb]/30 bg-[#2563eb]/5 hover:border-[#2563eb] p-5 transition-colors disabled:opacity-50">
                <span className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2563eb] to-[#06b6d4] text-white flex items-center justify-center shadow-[0_6px_18px_rgba(37,99,235,0.35)]"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></svg></span>
                <p className="mt-3 text-[15px] font-bold text-[#241f17]">프롬프트로 제작</p>
                <p className="text-[12.5px] text-[#6b6152] mt-1">한 줄만 적으면 AI가 게임을 만들어요. 템플릿·수정·게시까지 여기서 끝.</p>
              </button>
              <a href="/submit" className="group text-left rounded-2xl border-2 border-[#e0d8c6] hover:border-[#2563eb] bg-white p-5 transition-colors">
                <span className="w-11 h-11 rounded-full bg-white border border-[#ddd3bf] text-[#4a4337] flex items-center justify-center group-hover:border-[#2563eb] group-hover:text-[#2563eb] transition-colors"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg></span>
                <p className="mt-3 text-[15px] font-bold text-[#241f17]">외부 링크로 등록</p>
                <p className="text-[12.5px] text-[#6b6152] mt-1">이미 만든 게임이 있다면 URL이나 HTML 파일로 바로 등록해요.</p>
              </a>
              <a href="/broadcast" className="group text-left rounded-2xl border-2 border-[#e11d48]/25 hover:border-[#e11d48] bg-[#fff5f7] p-5 transition-colors">
                <span className="w-11 h-11 rounded-full bg-[#e11d48] text-white flex items-center justify-center shadow-[0_6px_18px_rgba(225,29,72,0.3)]"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><rect x="3" y="7" width="13" height="10" rx="2" /><path d="m16 10 5-2v8l-5-2" /></svg></span>
                <p className="mt-3 text-[15px] font-bold text-[#241f17]">방송 추가</p>
                <p className="text-[12.5px] text-[#6b6152] mt-1">폰 카메라나 유튜브·트위치 링크로 게임 방송을 켜요. 피드에 LIVE 카드로 노출.</p>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
