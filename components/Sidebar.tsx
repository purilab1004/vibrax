'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Genre, StudioProject } from '@/lib/supabase/types'
import { formatViewers } from '@/lib/format'

// kick 스타일 좌측 사이드바 — 홈/장르 메뉴 + 라이브 게임 채널 목록.
// 기본 펼침(w-56), 토글로 아이콘 레일(w-14). 본문 여백은 --rail-w CSS 변수로 동기화.
// 데스크탑(md+) 전용. 모바일은 헤더 햄버거 메뉴가 내비를 담당.

export interface SidebarChannel {
  id: string
  title: string
  thumbnail_url: string
  genre: Genre
  view_count: number
}

const ICON = 'w-5 h-5 shrink-0'
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function HomeIcon() {
  return <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></svg>
}
const GENRE_ICON: Record<Genre, React.ReactNode> = {
  action: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>,
  adventure: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" /></svg>,
  strategy: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="0.6" /></svg>,
  sports: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></svg>,
}

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

// 순위(1~3위) 강조색 — 금·은·동
const RANK_COLOR = ['text-[#ffd24d]', 'text-gray-300', 'text-amber-600']

export default function Sidebar({ newGenres = [], channels = [], tournament = [] }: {
  newGenres?: string[]
  channels?: SidebarChannel[]
  tournament?: SidebarChannel[]
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()
  const { T } = useLang()
  const [open, setOpen] = useState(true)
  // 스튜디오에서는 장르/채널 대신 내 프로젝트 목록을 보여준다
  const inStudio = pathname.startsWith('/studio')
  // 마이페이지에서는 프로필 섹션 메뉴만 보여준다
  const inProfile = pathname.startsWith('/profile')
  const [projects, setProjects] = useState<StudioProject[]>([])

  // 본문(main/footer) 여백을 사이드바 폭과 동기화
  useEffect(() => {
    document.documentElement.style.setProperty('--rail-w', open ? '14rem' : '3.5rem')
  }, [open])

  useEffect(() => {
    if (!inStudio) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('studio_projects').select('id, user_id, title, created_at')
        .order('created_at', { ascending: false }).limit(30)
        .then(({ data }) => setProjects((data as StudioProject[] | null) ?? []))
    })
  }, [inStudio, pathname])

  const createProject = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login?redirect=/studio'); return }
    const { data } = await supabase.from('studio_projects')
      .insert([{ user_id: user.id }] as never).select().single()
    if (data) router.push(`/studio/${(data as StudioProject).id}`)
  }

  const deleteProject = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(T.studio.deleteConfirm)) return
    const supabase = createClient()
    const { error } = await supabase.from('studio_projects').delete().eq('id', id)
    if (error) {
      // 23503 = 게시된 게임(games.studio_project_id)이 참조 중 — 공개 게임 보호
      alert(error.code === '23503' ? T.studio.cantDeletePublished : T.studio.requestError)
      return
    }
    setProjects(prev => prev.filter(p => p.id !== id))
    if (pathname === `/studio/${id}`) router.push('/studio')
  }

  const activeGenre = pathname === '/games' ? params.get('genre') : null
  const isHome = pathname === '/'

  const row = (active: boolean) =>
    `flex items-center h-11 transition-colors ${
      active ? 'text-[#00ff41] bg-[#00ff41]/10' : 'text-gray-300 hover:text-[#00ff41] hover:bg-white/5'
    }`
  // 아이콘은 접힌 폭(w-14)과 같은 고정 컬럼에 가운데 정렬 → 접힌 상태에서 중앙에 보임
  const iconCol = 'w-14 shrink-0 flex items-center justify-center'
  const label = `text-[13px] font-medium tracking-wider whitespace-nowrap pr-2 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`

  return (
    <aside
      className={`hidden md:flex fixed top-14 left-0 bottom-0 z-40 flex-col overflow-hidden border-r border-gray-800 bg-[#0a0a0a]/95 backdrop-blur-sm transition-[width] duration-200 ${open ? 'w-56' : 'w-14'}`}
      aria-label="sidebar"
    >
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'collapse' : 'expand'}
        className="flex items-center h-12 shrink-0 border-b border-gray-800 text-gray-400 hover:text-[#00ff41] transition-colors"
      >
        <span className={iconCol}>
          {open ? (
            <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="m11 6-5 6 5 6M18 6l-5 6 5 6" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </span>
        <span className={label}>{T.nav.categories}</span>
      </button>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <nav className="flex flex-col py-1">
          <Link href="/" className={row(isHome)} title={T.nav.home}>
            <span className={iconCol}><HomeIcon /></span>
            <span className={label}>{T.nav.home}</span>
          </Link>

          <div className="my-1 mx-3 border-t border-gray-800/70" />

          {inStudio && (
            <>
              <button onClick={createProject} className={row(false)} title={T.studio.newProject}>
                <span className={iconCol}>
                  <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M12 5v14M5 12h14" /></svg>
                </span>
                <span className={label}>{T.studio.newProject.replace('+ ', '')}</span>
              </button>
              <div className="mt-2 mb-1 px-4 h-6 flex items-center">
                {open ? (
                  <span className="font-pixel text-[10px] text-gray-500 tracking-widest whitespace-nowrap">MY GAMES</span>
                ) : (
                  <span className="w-full border-t border-gray-800/70" />
                )}
              </div>
              {projects.map(p => {
                const active = pathname === `/studio/${p.id}`
                return (
                  <Link key={p.id} href={`/studio/${p.id}`} className={`${row(active)} group/proj`} title={p.title || T.studio.untitled}>
                    <span className={iconCol}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" {...stroke}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
                    </span>
                    <span className={`flex-1 min-w-0 text-[13px] truncate transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'} ${active ? 'text-[#00ff41]' : 'text-gray-300'}`}>
                      {p.title || T.studio.untitled}
                    </span>
                    <button
                      onClick={e => deleteProject(e, p.id)}
                      aria-label="delete project"
                      className={`pr-3 shrink-0 text-gray-600 hover:text-red-400 transition-all text-sm opacity-0 group-hover/proj:opacity-100 ${open ? '' : 'hidden'}`}
                    >
                      ✕
                    </button>
                  </Link>
                )
              })}
            </>
          )}

          {inProfile && (
            <>
              {([
                ['#profile', 'PROFILE', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" /></svg>],
                ['#password', 'CHANGE PASSWORD', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>],
                ['#agent', 'MY AGENT', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="5" y="7" width="14" height="11" rx="2" /><path d="M12 7V4M9 12h.01M15 12h.01M9.5 15.5c.8.7 4.2.7 5 0" /></svg>],
              ] as [string, string, React.ReactNode][]).map(([hash, label2, icon]) => (
                <a key={hash} href={`/profile${hash}`} className={row(false)} title={label2}>
                  <span className={iconCol}>{icon}</span>
                  <span className={label}>{label2}</span>
                </a>
              ))}
            </>
          )}

          {!inStudio && !inProfile && GENRES.map(g => {
            const isNew = newGenres.includes(g)
            return (
              <Link key={g} href={`/games?genre=${g}`} className={row(activeGenre === g)} title={isNew ? `${T.genres[g]} (NEW)` : T.genres[g]}>
                <span className={`${iconCol} relative`}>
                  {GENRE_ICON[g]}
                  {isNew && <span className="absolute top-2 right-3.5 w-1.5 h-1.5 rounded-full bg-[#00ff41] ring-2 ring-[#0a0a0a]" />}
                </span>
                <span className={label}>{T.genres[g]}</span>
                {isNew && open && (
                  <span className="font-pixel text-[10px] text-black bg-[#00ff41] px-1 py-px tracking-widest shrink-0">NEW</span>
                )}
              </Link>
            )
          })}
        </nav>

        {!inStudio && !inProfile && channels.length > 0 && (
          <>
            <div className="mt-2 mb-1 px-4 h-6 flex items-center">
              {open ? (
                <span className="font-pixel text-[10px] text-gray-500 tracking-widest whitespace-nowrap">{T.nav.liveChannels}</span>
              ) : (
                <span className="w-full border-t border-gray-800/70" />
              )}
            </div>
            <nav className="flex flex-col pb-3">
              {channels.map(ch => (
                <Link
                  key={ch.id}
                  href={`/games/${ch.id}`}
                  className="flex items-center h-11 text-gray-300 hover:bg-white/5 transition-colors group"
                  title={ch.title}
                >
                  <span className={iconCol}>
                    <span className="relative w-7 h-7 rounded-full overflow-hidden border border-gray-700 group-hover:border-[#00ff41] transition-colors">
                      <Image src={ch.thumbnail_url} alt={ch.title} fill className="object-cover" sizes="28px" />
                    </span>
                  </span>
                  <span className={`flex-1 min-w-0 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="block text-[13px] text-gray-200 truncate leading-tight group-hover:text-[#00ff41] transition-colors">{ch.title}</span>
                    <span className="block font-pixel text-[10px] text-gray-600 tracking-widest">{T.genres[ch.genre]}</span>
                  </span>
                  <span className={`flex items-center gap-1 pr-3 shrink-0 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[11px] text-gray-400">{formatViewers(ch.view_count)}</span>
                  </span>
                </Link>
              ))}
            </nav>
          </>
        )}

        {!inStudio && !inProfile && tournament.length > 0 && (
          <>
            <div className="mt-2 mb-1 px-4 h-6 flex items-center">
              {open ? (
                <Link href="/tournament" className="font-pixel text-[10px] text-gray-500 hover:text-[#ffd24d] tracking-widest whitespace-nowrap transition-colors">🏆 {T.nav.tournament} →</Link>
              ) : (
                <span className="w-full border-t border-gray-800/70" />
              )}
            </div>
            <nav className="flex flex-col pb-3">
              {tournament.map((ch, i) => (
                <Link
                  key={ch.id}
                  href={`/games/${ch.id}`}
                  className="flex items-center h-11 text-gray-300 hover:bg-white/5 transition-colors group"
                  title={`#${i + 1} ${ch.title}`}
                >
                  <span className={iconCol}>
                    <span className="relative w-7 h-7 rounded-full overflow-hidden border border-gray-700 group-hover:border-[#00ff41] transition-colors">
                      <Image src={ch.thumbnail_url} alt={ch.title} fill className="object-cover" sizes="28px" />
                    </span>
                  </span>
                  <span className={`flex-1 min-w-0 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="block text-[13px] text-gray-200 truncate leading-tight group-hover:text-[#00ff41] transition-colors">{ch.title}</span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor" aria-hidden><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5Z" /></svg>
                      {formatViewers(ch.view_count)}
                    </span>
                  </span>
                  <span className={`pr-3.5 shrink-0 font-pixel text-[11px] ${RANK_COLOR[i] ?? 'text-gray-600'} transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}>
                    #{i + 1}
                  </span>
                </Link>
              ))}
            </nav>
          </>
        )}
      </div>
    </aside>
  )
}
