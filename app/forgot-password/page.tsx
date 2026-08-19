'use client'
// 비밀번호 찾기 — 이메일로 재설정 링크 발송
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AuthShell, { authInput, authLabel, authPrimary } from '@/components/auth/AuthShell'

function Inner() {
  const sp = useSearchParams()
  const [email, setEmail] = useState(sp.get('email') ?? '')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null)
    const r = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setError(j.error ?? '실패했어요.'); return }
    setSent(true)
  }
  return (
    <AuthShell eyebrow="RESET PASSWORD" title="비밀번호를 잊으셨나요?" subtitle="가입한 이메일을 입력하면 재설정 링크를 보내드려요."
      footer={<p><Link href="/login" className="font-semibold text-[#2563eb] hover:underline">← 로그인으로 돌아가기</Link></p>}>
      {sent ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-[15px] font-bold text-emerald-800">메일을 보냈어요</p>
          <p className="mt-1 text-[13px] text-emerald-700 leading-relaxed"><b>{email}</b> 로 재설정 링크를 보냈어요. 메일함(스팸함 포함)을 확인하고 링크를 눌러 새 비밀번호를 설정하세요. 링크는 1시간 동안 유효합니다.</p>
          <button onClick={() => setSent(false)} className="mt-4 text-[12.5px] font-semibold text-emerald-800 underline">다른 이메일로 다시 보내기</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div><label className={authLabel}>이메일</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" className={authInput} autoFocus /></div>
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[13px] px-3.5 py-2.5">{error}</p>}
          <button type="submit" disabled={busy || !email} className={authPrimary}>{busy ? '보내는 중…' : '재설정 링크 보내기'}</button>
        </form>
      )}
    </AuthShell>
  )
}
export default function ForgotPasswordPage() { return <Suspense><Inner /></Suspense> }
