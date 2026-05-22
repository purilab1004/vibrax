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
  const [menuOpen, setMenuOpen] = useState(false)
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

  const handleSignOut = async () => {
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLinkDesktop = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-xs tracking-widest transition-colors hover:text-[#00ff41] ${
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
      className={`text-[10px] tracking-widest font-pixel transition-colors ${
        lang === l ? 'text-[#00ff41]' : 'text-gray-600 hover:text-gray-400'
      }`}
    >
      {label}
    </button>
  )

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-800 bg-[#0a0a0a]/95 backdrop-blur-sm">
        <nav className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="font-pixel text-[#00ff41] text-xs tracking-widest hover:text-white transition-colors"
          >
            VIBRAX
          </Link>

          {/* ── Desktop nav ── */}
          <div className="hidden md:flex items-center gap-6">
            {navLinkDesktop('/games', T.nav.games)}
            {navLinkDesktop('/about', T.nav.about)}
            {user ? (
              <>
                {navLinkDesktop('/submit', T.nav.submit)}
                {navLinkDesktop('/profile', T.nav.mypage)}
                <button
                  onClick={handleSignOut}
                  className="text-xs tracking-widest text-gray-400 hover:text-[#00ff41] transition-colors"
                >
                  {T.nav.logout}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="text-xs tracking-widest bg-[#00ff41] text-black px-4 py-1.5 hover:bg-[#00cc33] transition-colors font-pixel"
              >
                {T.nav.login}
              </Link>
            )}
            <div className="flex items-center gap-1 border-l border-gray-800 pl-5">
              {langBtn('ko', 'KO')}
              <span className="text-gray-700 text-[10px]">|</span>
              {langBtn('en', 'EN')}
            </div>
          </div>

          {/* ── Mobile: lang switcher + hamburger ── */}
          <div className="flex md:hidden items-center gap-3">
            <div className="flex items-center gap-1">
              {langBtn('ko', 'KO')}
              <span className="text-gray-700 text-[10px]">|</span>
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
            VIBRAX
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
        <div className="flex flex-col px-8 pt-10 pb-6 flex-1 justify-between">
          <nav className="flex flex-col">
            {navLinkMobile('/games', T.nav.games)}
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
              <span className="text-gray-700 text-[10px]">|</span>
              {langBtn('en', 'EN')}
            </div>
            <span className="text-[10px] text-gray-700 font-pixel ml-auto">© VIBRAX 2026</span>
          </div>
        </div>
      </div>
    </>
  )
}
