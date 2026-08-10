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
  useEffect(() => { setMenuOpen(false) }, [pathname])

  // 상단에서는 투명, 스크롤하면 유리(글래스) 배경
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 관리자 링크는 user 블록 안에서만 렌더되므로 로그아웃 시 초기화가 필요 없다
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      .then(({ data }) => setIsAdmin((data as { role?: string } | null)?.role === 'admin'))
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
      className="sand-float flex items-center h-7 w-[64px] shrink-0 rounded-full border border-[#ddd3bf] bg-white text-[10px] font-bold tracking-wider hover:border-[#2563eb]/50 transition-colors"
    >
      <span
        aria-hidden
        className={`absolute top-[2px] bottom-[2px] w-[29px] rounded-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] shadow-[0_1px_4px_rgba(37,99,235,0.35)] transition-transform duration-200 ${
          lang === 'en' ? 'translate-x-[31px]' : 'translate-x-[2px]'
        }`}
      />
      <span className={`relative flex-1 text-center transition-colors ${lang === 'ko' ? 'text-white' : 'text-[#857a68]'}`}>KO</span>
      <span className={`relative flex-1 text-center transition-colors ${lang === 'en' ? 'text-white' : 'text-[#857a68]'}`}>EN</span>
    </button>
  )

  // 관리자 — 큰 메뉴 없이 로고 + 관리자 홈 + 복귀/로그아웃만 있는 미니 헤더 (Notion풍)
  if (pathname.startsWith('/admin')) {
    return (
      <header className="sticky top-0 z-50 border-b border-[#ebe4d6] bg-[#fcfaf5]/95 backdrop-blur-sm md:pl-[var(--rail-w,0rem)] transition-[padding] duration-200">
        <nav className="w-full px-5 h-14 flex items-center gap-5">
          {/* 데스크톱은 사이드바 상단에 로고가 있으므로 모바일에서만 표시 */}
          <Link href="/" className="md:hidden group flex items-center gap-2 text-[#241f17] text-xl font-extrabold tracking-tight hover:opacity-80 transition-opacity shrink-0">
            <LogoMark />
            <span>vibrex<span className="text-[#2563eb]">cup</span></span>
          </Link>
          <span className="text-[13px] font-semibold text-[#857a68] border border-[#ebe4d6] rounded px-2 py-0.5">
            ⚙ {T.nav.admin}
          </span>
          <div className="flex-1" />
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
        className={`sticky top-0 z-50 md:pl-[var(--rail-w,0rem)] transition-[padding,background-color,box-shadow,backdrop-filter] duration-200 ${
          scrolled ? 'bg-white/55 backdrop-blur-xl' : ''
        }`}
      >
        <nav className="w-full px-5 h-14 flex items-center gap-4">
          {/* 데스크톱은 사이드바 상단에 로고가 있으므로 모바일에서만 표시 */}
          <Link
            href="/"
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
            <div className="flex items-center justify-end gap-5">
              {user ? (
                <>
                  {navLinkDesktop('/submit', T.nav.submit)}
                  {navLinkDesktop('/profile', T.nav.mypage)}
                  <button
                    onClick={handleSignOut}
                    className="text-[13px] font-medium tracking-wider text-[#6b6152] hover:text-[#2563eb] transition-colors"
                  >
                    {T.nav.logout}
                  </button>
                  {isAdmin && navLinkDesktop('/admin', `⚙ ${T.nav.admin}`)}
                </>
              ) : (
                /* 파란 필 + 모래 위에 떠 있는 효과 */
                <Link
                  href="/login"
                  className="sand-float flex items-center h-9 rounded-full text-[13px] font-bold text-white bg-[#2563eb] px-5 hover:bg-[#1d4ed8] transition-colors"
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
            onClick={() => setMenuOpen(false)}
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
                {navLinkMobile('/submit', T.nav.submit)}
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
