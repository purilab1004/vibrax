'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const { T } = useLang()
  const a = T.auth

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      setMessage(a.signupSuccess)
    })
  }

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-500'

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-pixel text-[#00ff41] text-base mb-2 text-center tracking-widest">
          {a.signupHeading}
        </h1>
        <p className="text-gray-300 text-xs text-center mb-8">{a.signupSubtitle}</p>
        {message ? (
          <div className="border border-[#00ff41]/30 bg-[#00ff41]/5 p-6 text-center">
            <p className="font-pixel text-[#00ff41] text-[10px] mb-3">{a.sent}</p>
            <p className="text-gray-300 text-sm leading-relaxed">{message}</p>
            <Link
              href="/login"
              className="inline-block mt-4 text-xs text-gray-400 hover:text-[#00ff41] transition-colors"
            >
              {a.toLogin}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
                {a.email}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
                {a.password}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder={a.minLength}
                className={inputClass}
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#00ff41] text-black font-pixel text-[11px] py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50 mt-2 tracking-widest"
            >
              {isPending ? a.loading : a.createAccount}
            </button>
          </form>
        )}
        <p className="text-center text-xs text-gray-300 mt-6">
          {a.hasAccount}{' '}
          <Link href="/login" className="text-[#00ff41] hover:underline">
            LOGIN
          </Link>
        </p>
      </div>
    </div>
  )
}
