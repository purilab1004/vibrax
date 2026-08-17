'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const { T } = useLang()
  const a = T.auth

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      // 인증 메일 발송 문제로 임시로 서버에서 즉시 가입 처리 → 바로 로그인
      const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const json = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setError(json.error ?? '가입에 실패했어요. 잠시 후 다시 시도해 주세요.'); return }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); return }
      const redirect = new URLSearchParams(window.location.search).get('redirect') || '/'
      window.location.href = redirect
    })
  }

  const inputClass =
    'w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-3 text-sm outline-none transition-colors text-[#241f17] placeholder-[#a1957f]'

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-pixel text-[#2563eb] text-base mb-2 text-center tracking-widest">
          {a.signupHeading}
        </h1>
        <p className="text-[#4a4337] text-xs text-center mb-8">{a.signupSubtitle}</p>
        {message ? (
          <div className="border border-[#2563eb]/30 bg-[#2563eb]/5 p-6 text-center">
            <p className="font-pixel text-[#2563eb] text-[11px] mb-3">{a.sent}</p>
            <p className="text-[#4a4337] text-sm leading-relaxed">{message}</p>
            <Link
              href="/login"
              className="inline-block mt-4 text-xs text-[#6b6152] hover:text-[#2563eb] transition-colors"
            >
              {a.toLogin}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
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
              <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
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
              className="w-full bg-[#2563eb] text-white font-pixel text-[11px] py-3 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 mt-2 tracking-widest"
            >
              {isPending ? a.loading : a.createAccount}
            </button>
          </form>
        )}
        <p className="text-center text-xs text-[#4a4337] mt-6">
          {a.hasAccount}{' '}
          <Link href="/login" className="text-[#2563eb] hover:underline">
            LOGIN
          </Link>
        </p>
      </div>
    </div>
  )
}
