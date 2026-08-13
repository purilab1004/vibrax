'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// 비밀번호 재설정 — 이메일 링크로 진입 (링크 클릭 시 복구 세션이 자동으로 잡힌다)
export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  // 복구 링크의 세션이 잡혔는지 확인
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setReady(!!session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (password !== confirm) { setError('비밀번호가 서로 다릅니다.'); return }
    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setError(error.message); return }
      setDone(true)
      setTimeout(() => { router.push('/'); router.refresh() }, 1500)
    })
  }

  const inputClass =
    'w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-3 text-sm outline-none transition-colors text-[#241f17] placeholder-[#a1957f]'

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-pixel text-[#2563eb] text-base mb-2 text-center tracking-widest">
          RESET PASSWORD
        </h1>
        <p className="text-[#4a4337] text-xs text-center mb-8">새 비밀번호를 설정하세요</p>

        {done ? (
          <p className="text-center text-[#2563eb] text-sm border border-[#2563eb]/30 bg-[#2563eb]/5 rounded px-4 py-5">
            ✅ 비밀번호가 변경되었습니다! 잠시 후 홈으로 이동해요.
          </p>
        ) : !ready ? (
          <p className="text-center text-[#6b6152] text-sm border border-[#ebe4d6] bg-white rounded px-4 py-5">
            재설정 링크를 확인하는 중이에요...<br />
            <span className="text-xs text-[#9d9280]">이 화면이 계속되면 로그인 화면에서 비밀번호 찾기로 새 링크를 받아주세요.</span>
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">새 비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">새 비밀번호 확인</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#2563eb] text-white font-pixel text-[11px] py-3 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 mt-2 tracking-widest"
            >
              {isPending ? 'SAVING...' : '비밀번호 변경'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
