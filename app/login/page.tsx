'use client'

import { useState, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'
  const supabase = createClient()
  const { T } = useLang()
  const a = T.auth

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      router.push(redirect)
      router.refresh()
    })
  }

  // 비밀번호 찾기 — 입력한 이메일로 재설정 링크 발송
  const handleForgotPassword = () => {
    setError(null)
    setResetMsg(null)
    if (!email.trim()) {
      setError('이메일을 먼저 입력해주세요.')
      return
    }
    startTransition(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        setError(error.message)
        return
      }
      setResetMsg('비밀번호 재설정 링크를 이메일로 보냈어요. 메일함(스팸함 포함)을 확인해주세요.')
    })
  }

  const inputClass =
    'w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-3 text-sm outline-none transition-colors text-[#241f17] placeholder-[#a1957f]'

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-pixel text-[#2563eb] text-base mb-2 text-center tracking-widest">
          {a.loginHeading}
        </h1>
        <p className="text-[#4a4337] text-xs text-center mb-8">{a.loginSubtitle}</p>
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
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          {error && (
            <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">
              {error}
            </p>
          )}
          {resetMsg && (
            <p className="text-[#2563eb] text-xs border border-[#2563eb]/30 bg-[#2563eb]/5 px-3 py-2 rounded">
              ✉️ {resetMsg}
            </p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#2563eb] text-white font-pixel text-[11px] py-3 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 mt-2 tracking-widest"
          >
            {isPending ? a.loading : a.login}
          </button>
        </form>
        <div className="flex items-center justify-center gap-4 mt-6 text-xs">
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isPending}
            className="text-[#857a68] hover:text-[#2563eb] hover:underline transition-colors disabled:opacity-50"
          >
            비밀번호 찾기
          </button>
          <span className="text-[#ddd3bf]">|</span>
          <p className="text-[#4a4337]">
            {a.noAccount}{' '}
            <Link href="/signup" className="text-[#2563eb] hover:underline">
              SIGNUP
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
