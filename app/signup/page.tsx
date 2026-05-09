'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        return
      }
      setMessage('인증 이메일을 발송했습니다. 이메일 링크를 클릭하면 가입이 완료됩니다.')
    })
  }

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-500'

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-pixel text-[#00ff41] text-base mb-2 text-center tracking-widest">
          SIGNUP
        </h1>
        <p className="text-gray-300 text-xs text-center mb-8">
          무료로 가입하고 게임을 등록하세요
        </p>
        {message ? (
          <div className="border border-[#00ff41]/30 bg-[#00ff41]/5 p-6 text-center">
            <p className="font-pixel text-[#00ff41] text-[10px] mb-3">✓ SENT!</p>
            <p className="text-gray-300 text-sm leading-relaxed">{message}</p>
            <Link
              href="/login"
              className="inline-block mt-4 text-xs text-gray-400 hover:text-[#00ff41] transition-colors"
            >
              → 로그인 페이지로
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
                EMAIL
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
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="최소 6자리"
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
              {isPending ? 'LOADING...' : 'CREATE ACCOUNT'}
            </button>
          </form>
        )}
        <p className="text-center text-xs text-gray-300 mt-6">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-[#00ff41] hover:underline">
            LOGIN
          </Link>
        </p>
      </div>
    </div>
  )
}
