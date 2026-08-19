'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import AuthShell, { authInput, authLabel, authPrimary } from '@/components/auth/AuthShell'

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

  return (
    <AuthShell eyebrow="RESET PASSWORD" title="새 비밀번호 설정" subtitle="6자 이상으로 새 비밀번호를 정해주세요.">
      {done ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-[14px] font-semibold text-emerald-800">비밀번호가 변경되었어요! 잠시 후 홈으로 이동합니다.</div>
      ) : !ready ? (
        <div className="rounded-2xl border border-[#ebe4d6] bg-white p-5 text-[13px] text-[#6b6152]">재설정 링크를 확인하는 중이에요…<br /><span className="text-[12px] text-[#9d9280]">이 화면이 계속되면 링크가 만료된 거예요. <Link href="/forgot-password" className="text-[#2563eb] underline">새 링크 받기</Link></span></div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className={authLabel}>새 비밀번호</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" placeholder="6자 이상" className={authInput} autoFocus /></div>
          <div><label className={authLabel}>비밀번호 확인</label><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" placeholder="한 번 더 입력" className={authInput} /></div>
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[13px] px-3.5 py-2.5">{error}</p>}
          <button type="submit" disabled={isPending} className={authPrimary}>{isPending ? '변경 중…' : '비밀번호 변경'}</button>
        </form>
      )}
    </AuthShell>
  )
}
