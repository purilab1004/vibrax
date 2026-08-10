'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import LogoMark from '@/components/LogoMark'
import type { Genre, StudioProject } from '@/lib/supabase/types'
import { formatViewers } from '@/lib/format'

// kick 스타일 좌측 사이드바 — 홈/장르 메뉴 + 라이브 게임 채널 목록.
// 기본 접힘(아이콘 레일 w-14), 토글로 펼침(w-56). 본문 여백은 --rail-w CSS 변수로 동기화.
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
const RANK_COLOR = ['text-[#c9940c]', 'text-[#4a4337]', 'text-amber-600']

export default function Sidebar({ newGenres = [], channels = [], tournament = [] }: {
  newGenres?: string[]
  channels?: SidebarChannel[]
  tournament?: SidebarChannel[]
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()
  const { T } = useLang()
  const [open, setOpen] = useState(false)
  // 스튜디오에서는 장르/채널 대신 내 프로젝트 목록을 보여준다
  const inStudio = pathname.startsWith('/studio')
  // 마이페이지에서는 프로필 섹션 메뉴만 보여준다
  const inProfile = pathname.startsWith('/profile')
  // 관리자에서는 관리자 메뉴(대시보드/게임/블로그/공지/회원/신청/설정)를 보여준다
  const inAdmin = pathname.startsWith('/admin')
  const [projects, setProjects] = useState<StudioProject[]>([])

  // 본문(main/footer) 여백을 사이드바 폭과 동기화 — 접힘: 플로팅 버튼만 남으므로 0
  useEffect(() => {
    document.documentElement.style.setProperty('--rail-w', open ? '14rem' : '0rem')
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
      active ? 'text-[#2563eb] bg-[#2563eb]/10' : 'text-[#4a4337] hover:text-[#2563eb] hover:bg-[#241f17]/5'
    }`
  // 아이콘은 접힌 폭(w-14)과 같은 고정 컬럼에 가운데 정렬 → 접힌 상태에서 중앙에 보임
  const iconCol = 'w-14 shrink-0 flex items-center justify-center'
  const label = `text-[13px] font-medium tracking-wider whitespace-nowrap pr-2 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`

  // 접힘 — 좌상단 플로팅 'Menu' 버튼만
  if (!open) {
    return (
      <div className="hidden md:block fixed top-2.5 left-3 z-[60]">
        <button
          onClick={() => setOpen(true)}
          aria-label="open menu"
          className="flex items-center gap-2 h-9 px-2.5 rounded-lg bg-white border border-[#ebe4d6] text-[#241f17] shadow-[0_2px_10px_rgba(36,31,23,0.08)] hover:border-[#2563eb] hover:shadow-[0_4px_14px_rgba(37,99,235,0.18)] active:scale-[0.97] transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <LogoMark className="w-6 h-6 shrink-0" />
        </button>
      </div>
    )
  }

  return (
    <aside
      className="hidden md:flex fixed top-0 left-0 bottom-0 z-[60] w-56 flex-col overflow-hidden border-r border-[#ebe4d6] bg-[#fcfaf5]/95 backdrop-blur-sm"
      aria-label="sidebar"
    >
      {/* 로고 헤더 — 로고 + ← 닫기 버튼 */}
      <div className="flex items-center h-14 shrink-0">
        <Link href="/" className="flex items-center min-w-0 hover:opacity-80 transition-opacity" title="Vibrexcup">
          <span className={iconCol}><LogoMark /></span>
          <span className="text-lg font-extrabold tracking-tight text-[#241f17] whitespace-nowrap">
            vibrex<span className="text-[#2563eb]">cup</span>
            <span className="ml-1 align-top text-[8px] font-semibold px-1 py-px border border-red-500/70 text-red-500 rounded">
              BETA
            </span>
          </span>
        </Link>
        <button
          onClick={() => setOpen(false)}
          aria-label="close menu"
          className="ml-auto mr-3 w-7 h-7 flex items-center justify-center rounded-md bg-[#241f17]/5 hover:bg-[#241f17]/10 text-[#4a4337] hover:text-[#2563eb] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" {...stroke}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
        </button>
      </div>

      {/* 그라디언트 CTA — 프롬프트로 게임 시작 (펼침 + 일반 페이지에서만) */}
      {open && !inStudio && !inProfile && !inAdmin && (
        <div className={`shrink-0 pt-3 pb-1 ${open ? 'px-3' : 'px-2'}`}>
          <Link
            href="/studio"
            title={T.nav.createGame}
            className="block rounded-xl p-[1.5px] bg-gradient-to-r from-[#2563eb] to-[#06b6d4] hover:shadow-[0_4px_18px_rgba(37,99,235,0.3)] transition-shadow"
          >
            <span className={`flex items-center justify-center gap-1.5 rounded-[10.5px] bg-white h-10 text-[13px] font-bold text-[#2563eb] whitespace-nowrap overflow-hidden ${open ? 'px-3' : 'px-0'}`}>
              <span aria-hidden>✦</span>
              {open && T.nav.createGame}
            </span>
          </Link>
        </div>
      )}

      {/* 메뉴 본문 — 접힌 상태에서는 완전히 숨긴다 (로고 + 화살표만 남음) */}
      <div className={`flex-1 overflow-y-auto scrollbar-hide ${open ? '' : 'hidden'}`}>
        <nav className="flex flex-col py-1">
          <Link href="/" className={row(isHome)} title={T.nav.home}>
            <span className={iconCol}><HomeIcon /></span>
            <span className={label}>{T.nav.home}</span>
          </Link>

          <div className="my-1 mx-3 border-t border-[#ebe4d6]/70" />

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
                  <span className="font-pixel text-[10px] text-[#857a68] tracking-widest whitespace-nowrap">MY GAMES</span>
                ) : (
                  <span className="w-full border-t border-[#ebe4d6]/70" />
                )}
              </div>
              {projects.map(p => {
                const active = pathname === `/studio/${p.id}`
                return (
                  <Link key={p.id} href={`/studio/${p.id}`} className={`${row(active)} group/proj`} title={p.title || T.studio.untitled}>
                    <span className={iconCol}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" {...stroke}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
                    </span>
                    <span className={`flex-1 min-w-0 text-[13px] truncate transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'} ${active ? 'text-[#2563eb]' : 'text-[#4a4337]'}`}>
                      {p.title || T.studio.untitled}
                    </span>
                    <button
                      onClick={e => deleteProject(e, p.id)}
                      aria-label="delete project"
                      className={`pr-3 shrink-0 text-[#9d9280] hover:text-red-400 transition-all text-sm opacity-0 group-hover/proj:opacity-100 ${open ? '' : 'hidden'}`}
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

          {inAdmin && (
            <>
              {([
                ['/admin', T.admin.navDashboard, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="4" y="4" width="7" height="9" rx="1" /><rect x="13" y="4" width="7" height="5" rx="1" /><rect x="13" y="11" width="7" height="9" rx="1" /><rect x="4" y="15" width="7" height="5" rx="1" /></svg>],
                ['/admin/games', T.admin.navGames, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="3" y="7" width="18" height="11" rx="3" /><path d="M8 11v4M6 13h4M15 12h.01M17.5 14h.01" /></svg>],
                ['/admin/blog', T.admin.navBlog, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M5 4h11l3 3v13H5Z" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>],
                ['/admin/notices', T.admin.navNotices, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M4 10v4l10 4V6L4 10Z" /><path d="M14 8.5a3.5 3.5 0 0 1 0 7M6.5 14.5V19" /></svg>],
                ['/admin/members', T.admin.navMembers, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c1-3 3.2-4.5 5.5-4.5s4.5 1.5 5.5 4.5" /><circle cx="17" cy="9.5" r="2.3" /><path d="M16 14.7c2.5.2 4 1.6 4.5 4.3" /></svg>],
                ['/admin/applications', T.admin.navApplications, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M8 4h8l2 2v14H6V6l2-2Z" /><path d="M9 4v3h6V4M9 12l2 2 4-4" /></svg>],
                ['/admin/settings', T.admin.navSettings, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></svg>],
              ] as [string, string, React.ReactNode][]).map(([href, label2, icon]) => {
                const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
                return (
                  <Link key={href} href={href} className={row(active)} title={label2}>
                    <span className={iconCol}>{icon}</span>
                    <span className={label}>{label2}</span>
                  </Link>
                )
              })}
            </>
          )}

          {!inStudio && !inProfile && !inAdmin && GENRES.map(g => {
            const isNew = newGenres.includes(g)
            return (
              <Link key={g} href={`/games?genre=${g}`} className={row(activeGenre === g)} title={isNew ? `${T.genres[g]} (NEW)` : T.genres[g]}>
                <span className={`${iconCol} relative`}>
                  {GENRE_ICON[g]}
                  {isNew && <span className="absolute top-2 right-3.5 w-1.5 h-1.5 rounded-full bg-[#2563eb] ring-2 ring-[#fcfaf5]" />}
                </span>
                <span className={label}>{T.genres[g]}</span>
                {isNew && open && (
                  <span className="font-pixel text-[10px] text-white bg-[#2563eb] px-1 py-px tracking-widest shrink-0">NEW</span>
                )}
              </Link>
            )
          })}
        </nav>

        {!inStudio && !inProfile && !inAdmin && channels.length > 0 && (
          <>
            <div className="mt-2 mb-1 px-4 h-6 flex items-center">
              {open ? (
                <span className="font-pixel text-[10px] text-[#857a68] tracking-widest whitespace-nowrap">{T.nav.liveChannels}</span>
              ) : (
                <span className="w-full border-t border-[#ebe4d6]/70" />
              )}
            </div>
            <nav className="flex flex-col pb-3">
              {channels.map(ch => (
                <Link
                  key={ch.id}
                  href={`/games/${ch.id}`}
                  className="flex items-center h-11 text-[#4a4337] hover:bg-[#241f17]/5 transition-colors group"
                  title={ch.title}
                >
                  <span className={iconCol}>
                    <span className="relative w-7 h-7 rounded-full overflow-hidden border border-[#ddd3bf] group-hover:border-[#2563eb] transition-colors">
                      <Image src={ch.thumbnail_url} alt={ch.title} fill className="object-cover" sizes="28px" />
                    </span>
                  </span>
                  <span className={`flex-1 min-w-0 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="block text-[13px] text-[#3a332a] truncate leading-tight group-hover:text-[#2563eb] transition-colors">{ch.title}</span>
                    <span className="block font-pixel text-[10px] text-[#9d9280] tracking-widest">{T.genres[ch.genre]}</span>
                  </span>
                  <span className={`flex items-center gap-1 pr-3 shrink-0 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[11px] text-[#6b6152]">{formatViewers(ch.view_count)}</span>
                  </span>
                </Link>
              ))}
            </nav>
          </>
        )}

        {!inStudio && !inProfile && !inAdmin && tournament.length > 0 && (
          <>
            <div className="mt-2 mb-1 px-4 h-6 flex items-center">
              {open ? (
                <Link href="/tournament" className="font-pixel text-[10px] text-[#857a68] hover:text-[#c9940c] tracking-widest whitespace-nowrap transition-colors">🏆 {T.nav.tournament} →</Link>
              ) : (
                <span className="w-full border-t border-[#ebe4d6]/70" />
              )}
            </div>
            <nav className="flex flex-col pb-3">
              {tournament.map((ch, i) => (
                <Link
                  key={ch.id}
                  href={`/games/${ch.id}`}
                  className="flex items-center h-11 text-[#4a4337] hover:bg-[#241f17]/5 transition-colors group"
                  title={`#${i + 1} ${ch.title}`}
                >
                  <span className={iconCol}>
                    <span className="relative w-7 h-7 rounded-full overflow-hidden border border-[#ddd3bf] group-hover:border-[#2563eb] transition-colors">
                      <Image src={ch.thumbnail_url} alt={ch.title} fill className="object-cover" sizes="28px" />
                    </span>
                  </span>
                  <span className={`flex-1 min-w-0 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="block text-[13px] text-[#3a332a] truncate leading-tight group-hover:text-[#2563eb] transition-colors">{ch.title}</span>
                    <span className="flex items-center gap-1 text-xs text-[#857a68]">
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor" aria-hidden><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5Z" /></svg>
                      {formatViewers(ch.view_count)}
                    </span>
                  </span>
                  <span className={`pr-3.5 shrink-0 font-pixel text-[11px] ${RANK_COLOR[i] ?? 'text-[#9d9280]'} transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}>
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
