'use client'

import { useState, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'
  const supabase = createClient()

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

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-600'

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-pixel text-[#00ff41] text-base mb-2 text-center tracking-widest">
          LOGIN
        </h1>
        <p className="text-gray-600 text-xs text-center mb-8">
          Vibrax 계정으로 로그인하세요
        </p>
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
              placeholder="••••••••"
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
            {isPending ? 'LOADING...' : 'LOGIN'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-600 mt-6">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-[#00ff41] hover:underline">
            SIGNUP
          </Link>
        </p>
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
