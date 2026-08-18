'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useLang } from '@/lib/i18n/context'
import type { Lang } from '@/lib/i18n/translations'
import LogoMark from '@/components/LogoMark'

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [vcoin, setVcoin] = useState<number | null>(null)
  const [hideMobile, setHideMobile] = useState(false)
  const [pastHero, setPastHero] = useState(false) // 홈 — 프롬프트(히어로) 섹션을 지나면 /games 헤더처럼 검색바
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
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
    supabase.from('profiles').select('role, vcoin').eq('id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          // vcoin 컬럼 마이그레이션 전 — role만 폴백 조회
          supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
            .then(({ data: d2 }) => setIsAdmin((d2 as { role?: string } | null)?.role === 'admin'))
          return
        }
        const p = data as { role?: string; vcoin?: number } | null
        setIsAdmin(p?.role === 'admin')
        setVcoin(p?.vcoin ?? null)
      })
  }, [user])

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

  const navLinkMobile = (href: string, label: string) => (
    <Link
      href={href}
      onClick={() => setMenuOpen(false)}
      className={`font-pixel text-2xl tracking-widest transition-colors py-3 ${
        pathname === href ? 'text-[#2563eb]' : 'text-[#241f17] hover:text-[#2563eb]'
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

  // 관리자 — 큰 메뉴 없이 로고 + 관리자 홈 + 복귀/로그아웃만 있는 미니 헤더 (Notion풍)
  if (pathname.startsWith('/admin')) {
    return (
      <header className="sticky top-0 z-50 border-b border-[#ebe4d6] bg-[#fcfaf5]/95 backdrop-blur-sm md:pl-[var(--rail-w,0rem)] transition-[padding] duration-200">
        <nav className="w-full px-5 h-14 flex items-center gap-5">
          {/* 데스크톱은 사이드바 상단에 로고가 있으므로 모바일에서만 표시 */}
          <Link href="/admin" className="md:hidden group flex items-center gap-2 text-[#241f17] text-xl font-extrabold tracking-tight hover:opacity-80 transition-opacity shrink-0">
            <LogoMark />
            <span>vibrex<span className="text-[#2563eb]">admin</span></span>
          </Link>
          <div className="flex-1" />
          <span className="hidden md:inline text-[15px] font-extrabold tracking-tight text-[#241f17] mr-2">vibrex<span className="text-[#2563eb]">admin</span></span>
          <Link
            href="/admin"
            className={`text-[13px] font-medium transition-colors hover:text-[#2563eb] ${
              pathname === '/admin' ? 'text-[#2563eb]' : 'text-[#4a4337]'
            }`}
          >
            {T.nav.adminHome}
          </Link>
          <Link href="/" className="text-[13px] font-medium text-[#6b6152] hover:text-[#241f17] transition-colors">
            {T.nav.backToSite}
          </Link>
          {user && (
            <button
              onClick={handleSignOut}
              className="text-[13px] font-medium text-[#6b6152] hover:text-[#2563eb] transition-colors"
            >
              {T.nav.logout}
            </button>
          )}
          <div className="flex items-center gap-1 border-l border-[#ebe4d6] pl-4">
            <LangSwitch />
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
              <form onSubmit={handleSearch} className="w-[min(620px,50vw)] translate-x-[4.625rem]">
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
              {navLinkDesktop('/blog', T.nav.blog)}
              {navLinkDesktop('/partner', T.nav.partner)}
              {navLinkDesktop('/about', T.nav.about)}
            </div>
            )}
            <div className="flex items-center justify-end gap-5">
              {user ? (
                <>
                  {vcoin !== null && (
                    <span className="flex items-center gap-1 text-[13px] font-bold text-[#c9940c] whitespace-nowrap" title="VCOIN">
                      🪙 {vcoin.toLocaleString()}
                    </span>
                  )}
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
                          <Link href="/studio" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-[#4a4337] hover:bg-[#2563eb]/5 hover:text-[#2563eb] transition-colors"><svg viewBox="0 0 24 24" className="w-4 h-4 text-[#9d9280]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{lang === 'en' ? 'Submit' : '등록'}</Link>
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
        <div className="flex items-center justify-between px-6 h-14 border-b border-[#ebe4d6] shrink-0">
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
        <div className="flex flex-col px-8 pt-8 pb-6 flex-1 justify-between">
          <nav className="flex flex-col">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={T.nav.searchPlaceholder}
                  className="w-full bg-[#ffffff] border border-[#ebe4d6] focus:border-[#2563eb] pl-10 pr-3 py-3 text-sm text-[#241f17] placeholder-[#a1957f] outline-none transition-colors"
                  aria-label={T.nav.search}
                />
                <button type="submit" aria-label={T.nav.search} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#857a68]">
                  <SearchIcon />
                </button>
              </div>
            </form>
            {navLinkMobile('/games', T.nav.games)}
            {navLinkMobile('/studio', T.nav.studio)}
            <Link
              href="/tournament"
              onClick={() => setMenuOpen(false)}
              className="text-[#c9940c] font-pixel text-2xl tracking-widest transition-colors py-3 px-1 rounded"
            >
              🏆 {T.nav.tournament}
            </Link>
            {navLinkMobile('/blog', T.nav.blog)}
            {navLinkMobile('/partner', T.nav.partner)}
            {navLinkMobile('/about', T.nav.about)}
            {user ? (
              <>
                {navLinkMobile('/studio', T.nav.submit)}
                {navLinkMobile('/profile', T.nav.mypage)}
                <button
                  onClick={handleSignOut}
                  className="font-pixel text-2xl tracking-widest text-left text-[#6b6152] hover:text-[#2563eb] transition-colors py-3"
                >
                  {T.nav.logout}
                </button>
                {isAdmin && navLinkMobile('/admin', `⚙ ${T.nav.admin}`)}
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="mt-4 inline-block font-pixel text-sm tracking-widest bg-[#2563eb] text-white px-6 py-3 hover:bg-[#1d4ed8] transition-colors text-center"
              >
                {T.nav.login}
              </Link>
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
