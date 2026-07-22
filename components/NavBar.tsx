'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useLang } from '@/lib/i18n/context'
import type { Lang } from '@/lib/i18n/translations'

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
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
      className={`text-[13px] font-medium tracking-wider transition-colors hover:text-[#00ff41] ${
        pathname === href ? 'text-[#00ff41]' : 'text-gray-400'
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
        pathname === href ? 'text-[#00ff41]' : 'text-white hover:text-[#00ff41]'
      }`}
    >
      {label}
    </Link>
  )

  const langBtn = (l: Lang, label: string) => (
    <button
      onClick={() => setLang(l)}
      className={`text-[11px] tracking-widest font-pixel transition-colors ${
        lang === l ? 'text-[#00ff41]' : 'text-gray-600 hover:text-gray-400'
      }`}
    >
      {label}
    </button>
  )

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-800 bg-[#0a0a0a]/95 backdrop-blur-sm">
        <nav className="w-full px-5 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="group font-pixel text-[#00ff41] text-xs tracking-widest hover:text-white transition-colors shrink-0"
          >
            VIBREX<span className="text-[#ffd24d] group-hover:text-white transition-colors">CUP</span>
            <span className="ml-1 align-top font-pixel text-[6px] px-1 py-px border border-red-500/70 text-red-500 rounded">
              BETA
            </span>
          </Link>

          {/* ── Left: search ── */}
          <form onSubmit={handleSearch} className="hidden md:flex w-full max-w-xs">
            <div className="relative w-full">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={T.nav.searchPlaceholder}
                className="w-full bg-[#111] border border-gray-800 focus:border-[#00ff41] rounded-none pl-9 pr-3 py-2 text-[13px] text-white placeholder-gray-600 outline-none transition-colors"
                aria-label={T.nav.search}
              />
              <button type="submit" aria-label={T.nav.search} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#00ff41] transition-colors">
                <SearchIcon />
              </button>
            </div>
          </form>

          {/* spacer — push the rest to the right */}
          <div className="hidden md:block flex-1" />

          {/* ── Desktop nav (right) ── */}
          <div className="hidden md:flex items-center gap-6 shrink-0">
            {navLinkDesktop('/games', T.nav.games)}
            {navLinkDesktop('/studio', T.nav.studio)}
            {navLinkDesktop('/blog', T.nav.blog)}
            {navLinkDesktop('/about', T.nav.about)}
            {user ? (
              <>
                {navLinkDesktop('/submit', T.nav.submit)}
                {navLinkDesktop('/profile', T.nav.mypage)}
                <button
                  onClick={handleSignOut}
                  className="text-[13px] font-medium tracking-wider text-gray-400 hover:text-[#00ff41] transition-colors"
                >
                  {T.nav.logout}
                </button>
                {isAdmin && navLinkDesktop('/admin', `⚙ ${T.nav.admin}`)}
              </>
            ) : (
              <Link
                href="/login"
                className="font-pixel text-[11px] tracking-widest bg-[#00ff41] text-black px-5 py-2 hover:bg-[#00cc33] transition-colors"
              >
                {T.nav.login}
              </Link>
            )}
            <div className="flex items-center gap-1 border-l border-gray-800 pl-5">
              {langBtn('ko', 'KO')}
              <span className="text-gray-700 text-[11px]">|</span>
              {langBtn('en', 'EN')}
            </div>
          </div>

          {/* ── Mobile: lang switcher + hamburger ── */}
          <div className="flex md:hidden items-center gap-3 ml-auto">
            <div className="flex items-center gap-1">
              {langBtn('ko', 'KO')}
              <span className="text-gray-700 text-[11px]">|</span>
              {langBtn('en', 'EN')}
            </div>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="메뉴 열기"
              className="flex flex-col justify-center gap-1.5 w-8 h-8 items-center"
            >
              <span className="block w-5 h-px bg-gray-300" />
              <span className="block w-5 h-px bg-gray-300" />
              <span className="block w-5 h-px bg-gray-300" />
            </button>
          </div>
        </nav>
      </header>

      {/* ── Mobile full-screen menu overlay ── */}
      <div
        className={`fixed inset-0 z-[60] bg-[#0a0a0a] flex flex-col transition-all duration-300 md:hidden ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-gray-800 shrink-0">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="font-pixel text-[#00ff41] text-xs tracking-widest"
          >
            VIBREX<span className="text-[#ffd24d]">CUP</span>
            <span className="ml-1 align-top font-pixel text-[6px] px-1 py-px border border-red-500/70 text-red-500 rounded">
              BETA
            </span>
          </Link>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="메뉴 닫기"
            className="font-pixel text-[11px] text-gray-400 hover:text-[#00ff41] transition-colors border border-gray-700 px-3 py-1.5"
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
                  className="w-full bg-[#111] border border-gray-800 focus:border-[#00ff41] pl-10 pr-3 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors"
                  aria-label={T.nav.search}
                />
                <button type="submit" aria-label={T.nav.search} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  <SearchIcon />
                </button>
              </div>
            </form>
            {navLinkMobile('/games', T.nav.games)}
            {navLinkMobile('/studio', T.nav.studio)}
            {navLinkMobile('/blog', T.nav.blog)}
            {navLinkMobile('/about', T.nav.about)}
            {user ? (
              <>
                {navLinkMobile('/submit', T.nav.submit)}
                {navLinkMobile('/profile', T.nav.mypage)}
                <button
                  onClick={handleSignOut}
                  className="font-pixel text-2xl tracking-widest text-left text-gray-400 hover:text-[#00ff41] transition-colors py-3"
                >
                  {T.nav.logout}
                </button>
                {isAdmin && navLinkMobile('/admin', `⚙ ${T.nav.admin}`)}
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="mt-4 inline-block font-pixel text-sm tracking-widest bg-[#00ff41] text-black px-6 py-3 hover:bg-[#00cc33] transition-colors text-center"
              >
                {T.nav.login}
              </Link>
            )}
          </nav>

          {/* Footer lang + copyright */}
          <div className="flex items-center gap-4 border-t border-gray-800 pt-6">
            <div className="flex items-center gap-2">
              {langBtn('ko', 'KO')}
              <span className="text-gray-700 text-[11px]">|</span>
              {langBtn('en', 'EN')}
            </div>
            <span className="text-[11px] text-gray-700 font-pixel ml-auto">© VIBREXCUP 2026</span>
          </div>
        </div>
      </div>
    </>
  )
}
