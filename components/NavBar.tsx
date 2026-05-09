'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-xs tracking-widest transition-colors hover:text-[#00ff41] ${
        pathname === href ? 'text-[#00ff41]' : 'text-gray-400'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-[#0a0a0a]/95 backdrop-blur-sm">
      <nav className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-pixel text-[#00ff41] text-xs tracking-widest hover:text-white transition-colors"
        >
          VIBRAX
        </Link>
        <div className="flex items-center gap-6">
          {navLink('/games', 'GAMES')}
          {user ? (
            <>
              {navLink('/submit', '+ SUBMIT')}
              <button
                onClick={handleSignOut}
                className="text-xs tracking-widest text-gray-400 hover:text-[#00ff41] transition-colors"
              >
                LOGOUT
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-xs tracking-widest bg-[#00ff41] text-black px-4 py-1.5 hover:bg-[#00cc33] transition-colors font-pixel"
            >
              LOGIN
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
