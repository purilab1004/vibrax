'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useSoundPref, setSoundPref } from '@/lib/live/soundPref'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useLang } from '@/lib/i18n/context'
import type { Lang } from '@/lib/i18n/translations'
import { PromptCreditBadge } from '@/components/CurrencyBadge'
import LogoMark from '@/components/LogoMark'

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [credits, setCredits] = useState<number | null>(null) // 헤더 잔액 = 프롬코인(스튜디오와 같은 실제 크레딧)
  const [hideMobile, setHideMobile] = useState(false)
  const [pastHero, setPastHero] = useState(false) // 홈 — 프롬프트(히어로) 섹션을 지나면 /games 헤더처럼 검색바
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const soundPref = useSoundPref()
  // 검색 결과 페이지에서는 현재 검색어(?q=)를 입력창에 그대로 보여준다 (별도 안내 줄 없이). useSearchParams 는 Suspense 요구가 있어 location 으로 읽는다.
  useEffect(() => {
    const read = () => { try { setQuery(new URLSearchParams(window.location.search).get('q') ?? '') } catch { /* */ } }
    const t = setTimeout(read, 0); window.addEventListener('popstate', read)
    return () => { clearTimeout(t); window.removeEventListener('popstate', read) }
  }, [pathname])
  const supabase = createClient()
  const { lang, T, setLang } = useLang()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); setUserMenuOpen(false) }, [pathname])
  // 앱(WebView)이 상태바 뒤까지 차지할 때: 헤더가 있는 페이지는 헤더가 safe-area 만큼 내려오고, 헤더가 숨는 페이지는 본문이 내려온다(/games 피드는 예외)
  useEffect(() => {
    const hidden = pathname === '/games' || /^\/games\/[^/]+$/.test(pathname) || pathname.startsWith('/tournament')
    document.documentElement.classList.toggle('nav-hidden', hidden)
    return () => document.documentElement.classList.remove('nav-hidden')
  }, [pathname])

  // 상단에서는 투명, 스크롤하면 유리(글래스) 배경.
  // 모바일 홈: 쇼츠 피드로 넘어가면(히어로를 지나면) 헤더 숨김
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8)
      setHideMobile(pathname === '/' && window.scrollY > window.innerHeight * 0.6)
      setPastHero(pathname === '/' && window.scrollY > window.innerHeight * 0.6)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  // 관리자 링크는 user 블록 안에서만 렌더되므로 로그아웃 시 초기화가 필요 없다
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      .then(({ data }) => setIsAdmin((data as { role?: string } | null)?.role === 'admin'))
    const loadCredits = () => supabase.rpc('credit_balance' as never).then(({ data }) => setCredits(typeof data === 'number' ? data : 0))
    loadCredits()
    // 코인 넣기·잭팟 참여·생성 뒤 잔액 갱신
    const onChange = (e: Event) => { const b = (e as CustomEvent<{ balance?: number }>).detail?.balance; if (typeof b === 'number') setCredits(b); else loadCredits() }
    window.addEventListener('credits:changed', onChange)
    return () => window.removeEventListener('credits:changed', onChange)
  }, [user, supabase])

  const handleSignOut = async () => {
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    setMenuOpen(false)
    router.push(q ? `/games?q=${encodeURIComponent(q)}` : '/games')
  }

  const SearchIcon = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
    </svg>
  )

  const navLinkDesktop = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-[13px] font-medium tracking-wider transition-colors hover:text-[#2563eb] ${
        pathname === href ? 'text-[#2563eb]' : 'text-[#6b6152]'
      }`}
    >
      {label}
    </Link>
  )

  // KO/EN 토글 스위치 — 그라디언트 노브가 슬라이드
  const LangSwitch = () => (
    <button
      onClick={() => setLang((lang === 'ko' ? 'en' : 'ko') as Lang)}
      aria-label="toggle language"
      className="sand-float -top-0.5 flex items-center h-9 w-[80px] shrink-0 rounded-full border border-[#ddd3bf] bg-white text-[11px] font-bold tracking-wider hover:border-[#2563eb]/50 transition-colors"
    >
      <span
        aria-hidden
        className={`absolute top-[3px] bottom-[3px] w-[37px] rounded-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] shadow-[0_1px_4px_rgba(37,99,235,0.35)] transition-transform duration-200 ${
          lang === 'en' ? 'translate-x-[40px]' : 'translate-x-[3px]'
        }`}
      />
      <span className={`relative flex-1 text-center transition-colors ${lang === 'ko' ? 'text-white' : 'text-[#857a68]'}`}>KO</span>
      <span className={`relative flex-1 text-center transition-colors ${lang === 'en' ? 'text-white' : 'text-[#857a68]'}`}>EN</span>
    </button>
  )

  // 스튜디오 — 작업 공간이므로 헤더 없음 (자체 상단 바 사용)
  if (pathname.startsWith('/studio')) return null
  // AI 대시보드(/admin-ops) — 단독 화면, 자체 헤더 사용
  if (pathname.startsWith('/admin-ops')) return null

  // 관리자 — 큰 메뉴 없이 로고 + 관리자 홈 + 복귀/로그아웃만 있는 미니 헤더 (Notion풍)
  if (pathname.startsWith('/admin')) {
    return (
      <header className="sticky top-0 z-50 border-b border-[#e3e6ec] bg-white md:pl-[var(--rail-w,0rem)] transition-[padding] duration-200">
        <nav className="w-full px-3 md:px-4 h-12 flex items-center gap-2 md:gap-4">
          {/* 좌: 워드마크 + 관리자 검색 */}
          <Link href="/admin" className="flex items-center gap-2 text-[#1f2430] text-[15px] font-extrabold tracking-tight hover:opacity-80 transition-opacity shrink-0">
            <span className="md:hidden"><LogoMark /></span>
            <span>vibrex<span className="text-[#2563eb]">admin</span></span>
          </Link>
          <div className="flex-1" />
          {/* 모바일 — 회원 홈으로 (아이콘 + 짧은 라벨) */}
          <Link href="/" aria-label={T.nav.backToSite} title={T.nav.backToSite} className="sm:hidden inline-flex items-center gap-1 h-9 pl-2 pr-2.5 rounded-lg border border-[#d9dde5] bg-white text-[12.5px] font-semibold text-[#1f2430] active:bg-[#f3f5f8]">
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-[#2563eb]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></svg>
            {lang === 'en' ? 'Home' : '홈'}
          </Link>
          <Link href="/" className="hidden sm:inline-flex items-center h-8 px-3 rounded-md border border-[#d9dde5] bg-white text-[12.5px] font-medium text-[#1f2430] hover:bg-[#f3f5f8] transition-colors">
            {T.nav.backToSite}
          </Link>
          {user && (
            <button onClick={handleSignOut} className="inline-flex items-center h-8 px-2 md:px-3 rounded-md text-[12.5px] font-medium text-[#6b7280] hover:text-[#1f2430] hover:bg-[#f3f5f8] transition-colors">
              {T.nav.logout}
            </button>
          )}
          <div className="flex items-center gap-2 border-l border-[#e3e6ec] pl-2 md:pl-3">
            <div className="inline-flex items-center rounded-md border border-[#d9dde5] p-0.5">
              {(['ko', 'en'] as const).map(l => <button key={l} onClick={() => setLang(l)} className={`h-6 px-2 rounded text-[11px] font-bold ${lang === l ? 'bg-[#eef2ff] text-[#2563eb]' : 'text-[#6b7280] hover:text-[#1f2430]'}`}>{l.toUpperCase()}</button>)}
            </div>
            {user && <span className="hidden sm:inline-flex items-center gap-2 h-8 pl-1 pr-2.5 rounded-md border border-[#d9dde5] text-[12.5px] font-semibold text-[#1f2430]"><span className="w-6 h-6 rounded-md bg-[#2563eb] text-white flex items-center justify-center text-[11px] font-bold">{(user.email ?? 'A').charAt(0).toUpperCase()}</span>{user.email?.split('@')[0]}</span>}
          </div>
        </nav>
      </header>
    )
  }

  return (
    <>
      {/* 상단: 투명(첫 섹션 배경이 뒤로 지나감) → 스크롤: 유리 배경 */}
      <header
        className={`sticky top-0 z-50 md:pl-[var(--rail-w,0rem)] transition-[padding,background-color,box-shadow,backdrop-filter,transform] duration-200 ${
          (scrolled || pathname !== '/') && pathname !== '/games' ? 'bg-white/55 backdrop-blur-xl' : ''
        } ${hideMobile ? '-translate-y-full md:translate-y-0' : ''} ${pathname === '/games' || /^\/games\/[^/]+$/.test(pathname) || pathname.startsWith('/tournament') ? 'hidden md:block' : ''}`}
      >
        <nav className="w-full px-5 h-14 flex items-center gap-4">
          {/* 데스크톱은 사이드바 상단에 로고가 있으므로 모바일에서만 표시 */}
          <Link
            href="/"
            onClick={(e) => { if (pathname === '/') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) } }}
            className="md:hidden group flex items-center gap-2 text-[#241f17] text-xl font-extrabold tracking-tight hover:opacity-80 transition-opacity shrink-0"
          >
            <LogoMark />
            <span>
              vibrex<span className="text-[#2563eb]">cup</span>
              <span className="ml-1 align-top text-[8px] font-semibold px-1 py-px border border-red-500/70 text-red-500 rounded">
                BETA
              </span>
            </span>
          </Link>

          {/* ── Desktop: 3분할 그리드 — 메뉴는 중앙, 로그인/언어는 우측 ── */}
          <div className="hidden md:grid flex-1 grid-cols-[1fr_auto_1fr] items-center">
            <div />
            {pathname === '/games' || pastHero ? (
              /* /games (그리고 홈에서 히어로를 지난 뒤) — 유튜브식 중앙 검색바 */
              <div className="flex items-center gap-2 -translate-x-[2.25rem]">
              {/* 쇼츠 공용 스피커 — 검색바 왼쪽 (배경음·영상 소리를 함께 켜고 끔) */}
              <button type="button" onClick={() => setSoundPref({ on: !soundPref.on })} aria-label={soundPref.on ? '소리 끄기' : '소리 켜기'} title={soundPref.on ? '소리 끄기' : '소리 켜기'} className="shrink-0 w-10 h-10 rounded-full border border-[#ddd3bf] bg-white/95 shadow-[0_2px_10px_rgba(36,31,23,0.06)] text-[#6b6152] hover:text-[#2563eb] hover:border-[#2563eb] flex items-center justify-center transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" />{soundPref.on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19.5 5.5a9 9 0 0 1 0 13" /> : <path d="M22 9l-6 6M16 9l6 6" />}</svg>
              </button>
              <form onSubmit={handleSearch} className="w-[min(620px,50vw)]">
                <div className="flex items-center rounded-full border border-[#ddd3bf] bg-white/95 shadow-[0_2px_10px_rgba(36,31,23,0.06)] focus-within:border-[#2563eb] transition-colors overflow-hidden">
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={T.nav.searchPlaceholder}
                    aria-label={T.nav.search}
                    className="flex-1 bg-transparent px-5 py-2 text-sm text-[#241f17] placeholder-[#a1957f] outline-none"
                  />
                  <button
                    type="submit"
                    aria-label={T.nav.search}
                    className="shrink-0 h-9 px-4 bg-[#f5efe3] hover:bg-[#ece2cc] text-[#6b6152] hover:text-[#2563eb] transition-colors border-l border-[#ddd3bf]"
                  >
                    <SearchIcon />
                  </button>
                </div>
              </form>
              </div>
            ) : (
            <div className="flex items-center gap-6">
              {navLinkDesktop('/games', T.nav.games)}
              {navLinkDesktop('/studio', T.nav.studio)}
              <Link
                href="/tournament"
                className="text-[#c9940c] px-1.5 py-1 rounded text-[13px] font-semibold tracking-wider transition-colors hover:text-[#a1780a]"
              >
                🏆 {T.nav.tournament}
              </Link>
              {navLinkDesktop('/gallery', T.nav.library)}
              {navLinkDesktop('/story', T.nav.blog)}
              {navLinkDesktop('/partner', T.nav.partner)}
              {navLinkDesktop('/dev', T.nav.dev)}
              {navLinkDesktop('/about', T.nav.about)}
            </div>
            )}
            <div className="flex items-center justify-end gap-5">
              {user ? (
                <>
                  {credits !== null && <Link href="/credits" title="프롬코인 — 게임 플레이·잭팟·스튜디오 생성에 쓰는 크레딧"><PromptCreditBadge amount={credits} size="sm" label={false} /></Link>}
                  {/* 계정 드롭다운 — 등록/마이페이지/관리자/로그아웃을 하나로 정리 */}
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(v => !v)}
                      className="flex items-center gap-1.5 h-9 pl-1.5 pr-2.5 rounded-full border border-[#ddd3bf] bg-white hover:border-[#2563eb]/50 transition-colors"
                      aria-haspopup="menu"
                      aria-expanded={userMenuOpen}
                    >
                      <span className="w-6 h-6 rounded-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white flex items-center justify-center text-[11px] font-bold">
                        {(user.email ?? 'U').charAt(0).toUpperCase()}
                      </span>
                      <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 text-[#857a68] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {userMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                        <div className="absolute right-0 top-11 z-50 w-44 bg-white border border-[#ebe4d6] rounded-xl shadow-[0_10px_36px_rgba(36,31,23,0.14)] py-1.5 overflow-hidden">
                          <Link href="/studio" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-[#4a4337] hover:bg-[#2563eb]/5 hover:text-[#2563eb] transition-colors"><svg viewBox="0 0 24 24" className="w-4 h-4 text-[#9d9280]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{T.nav.createGame}</Link>
                          <Link href="/profile" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-[#4a4337] hover:bg-[#2563eb]/5 hover:text-[#2563eb] transition-colors"><svg viewBox="0 0 24 24" className="w-4 h-4 text-[#9d9280]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" /></svg>{lang === 'en' ? 'My Page' : '내 정보'}</Link>
                          {isAdmin && (
                            <Link href="/admin" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-[#4a4337] hover:bg-[#2563eb]/5 hover:text-[#2563eb] transition-colors"><svg viewBox="0 0 24 24" className="w-4 h-4 text-[#9d9280]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></svg>{lang === 'en' ? 'Admin' : '관리자'}</Link>
                          )}
                          <div className="my-1 border-t border-[#ebe4d6]" />
                          <button
                            onClick={handleSignOut}
                            className="w-full text-left px-4 py-2.5 text-[13px] text-[#857a68] hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            {T.nav.logout}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                /* 골드 필 — 모래·트로피 팔레트에서 딴 색 + 모래 위에 떠 있는 효과 */
                <Link
                  href="/login"
                  className="sand-float -top-0.5 flex items-center h-9 rounded-full text-[13px] font-bold text-white bg-gradient-to-b from-[#d9a71b] to-[#c9940c] px-5 hover:from-[#c9940c] hover:to-[#b3830a] transition-colors"
                >
                  {T.nav.login}
                </Link>
              )}
              <div className="flex items-center gap-1 border-l border-[#ebe4d6] pl-5">
                <LangSwitch />
              </div>
            </div>
          </div>

          {/* ── Mobile: lang switcher + hamburger ── */}
          <div className="flex md:hidden items-center gap-3 ml-auto">
            <div className="flex items-center gap-1">
              <LangSwitch />
            </div>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="메뉴 열기"
              className="flex flex-col justify-center gap-1.5 w-8 h-8 items-center"
            >
              <span className="block w-5 h-[1.5px] bg-[#241f17]" />
              <span className="block w-5 h-[1.5px] bg-[#241f17]" />
              <span className="block w-5 h-[1.5px] bg-[#241f17]" />
            </button>
          </div>
        </nav>
      </header>

      {/* ── Mobile full-screen menu overlay ── */}
      <div
        className={`fixed inset-0 z-[60] bg-[#fcfaf5] flex flex-col transition-all duration-300 md:hidden ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top bar */}
        <div className="app-top-pad flex items-center justify-between px-6 h-14 border-b border-[#ebe4d6] shrink-0 box-content">
          <Link
            href="/"
            onClick={(e) => { setMenuOpen(false); if (pathname === '/') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) } }}
            className="flex items-center gap-2 text-[#241f17] text-xl font-extrabold tracking-tight"
          >
            <LogoMark />
            <span>
              vibrex<span className="text-[#2563eb]">cup</span>
              <span className="ml-1 align-top text-[8px] font-semibold px-1 py-px border border-red-500/70 text-red-500 rounded">
                BETA
              </span>
            </span>
          </Link>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="메뉴 닫기"
            className="font-pixel text-[11px] text-[#6b6152] hover:text-[#2563eb] transition-colors border border-[#ddd3bf] px-3 py-1.5"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Menu items */}
        <div className="flex flex-col gap-6 px-5 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] flex-1 min-h-0 overflow-y-auto justify-between bg-[#fcfaf5]">
          <nav className="flex flex-col gap-5">
            {/* 검색 */}
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={T.nav.searchPlaceholder}
                  className="w-full h-12 rounded-2xl bg-white border border-[#ebe4d6] focus:border-[#2563eb] pl-11 pr-3 text-[15px] text-[#241f17] placeholder-[#a1957f] outline-none transition-colors"
                  aria-label={T.nav.search}
                />
                <button type="submit" aria-label={T.nav.search} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#857a68]">
                  <SearchIcon />
                </button>
              </div>
            </form>

            {/* 계정 */}
            {user ? (
              <div className="rounded-2xl bg-white border border-[#ebe4d6] p-3 flex items-center gap-2">
                <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex-1 min-w-0 flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563eb] to-[#06b6d4] text-white flex items-center justify-center font-extrabold shrink-0">{(user.email ?? '?').charAt(0).toUpperCase()}</span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-extrabold text-[#241f17]">{T.nav.mypage}</span>
                    <span className="block text-[11.5px] text-[#9d9280] truncate">{user.email}</span>
                  </span>
                </Link>
                {credits !== null && <Link href="/credits" onClick={() => setMenuOpen(false)}><PromptCreditBadge amount={credits} size="sm" label={false} /></Link>}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/login" onClick={() => setMenuOpen(false)} className="h-12 rounded-2xl bg-[#2563eb] text-white text-[15px] font-bold flex items-center justify-center">{T.nav.login}</Link>
                <Link href="/signup" onClick={() => setMenuOpen(false)} className="h-12 rounded-2xl bg-white border border-[#ebe4d6] text-[15px] font-bold text-[#241f17] flex items-center justify-center">{lang === 'en' ? 'Sign up' : '회원가입'}</Link>
              </div>
            )}

            {/* 메인 4 — 타일 */}
            <div className="grid grid-cols-2 gap-2.5">
              {([
                ['/games', T.nav.games, '🎮', 'from-[#2563eb] to-[#06b6d4]'],
                ['/studio', T.nav.studio, '✨', 'from-[#6366f1] to-[#2563eb]'],
                ['/tournament', T.nav.tournament, '🏆', 'from-[#f59e0b] to-[#ef4444]'],
                ['/gallery', T.nav.library, '🎨', 'from-[#8b5cf6] to-[#ec4899]'],
              ] as const).map(([href, label, icon, grad]) => (
                <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={`relative overflow-hidden h-[84px] rounded-2xl p-3 flex flex-col justify-between text-white bg-gradient-to-br ${grad} shadow-[0_10px_24px_-14px_rgba(37,99,235,0.6)] active:scale-[0.98] transition-transform ${pathname.startsWith(href) ? 'ring-2 ring-offset-2 ring-[#241f17]/30' : ''}`}>
                  <span className="text-[22px] leading-none">{icon}</span>
                  <span className="text-[15px] font-extrabold tracking-wide">{label}</span>
                </Link>
              ))}
            </div>

            {/* 더보기 — 작은 목록 */}
            <div className="rounded-2xl bg-white border border-[#ebe4d6] divide-y divide-[#f1ece2] overflow-hidden">
              {([
                ['/story', T.nav.blog],
                ['/partner', T.nav.partner],
                ['/dev', T.nav.dev],
                ['/about', T.nav.about],
                ...(isAdmin ? [['/admin', `⚙ ${T.nav.admin}`] as const] : []),
              ] as (readonly [string, string])[]).map(([href, label]) => (
                <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={`flex items-center justify-between h-12 px-4 text-[14.5px] font-semibold ${pathname.startsWith(href) ? 'text-[#2563eb]' : 'text-[#4a4337]'}`}>
                  {label}
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#c9bfae]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                </Link>
              ))}
            </div>

            {user && (
              <button onClick={handleSignOut} className="self-start text-[13px] font-semibold text-[#9d9280] hover:text-[#e11d48] px-1">{T.nav.logout}</button>
            )}
          </nav>

          {/* Footer lang + copyright */}
          <div className="flex items-center gap-4 border-t border-[#ebe4d6] pt-6">
            <div className="flex items-center gap-2">
              <LangSwitch />
            </div>
            <span className="text-[11px] text-[#b3a78f] font-pixel ml-auto">© VIBREXCUP 2026</span>
          </div>
        </div>
      </div>
    </>
  )
}
