'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import AuthShell, { GoogleIcon, authInput, authLabel, authPrimary } from '@/components/auth/AuthShell'
import ConsentForm, { type Consent } from '@/components/auth/ConsentForm'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [oauthPending, setOauthPending] = useState(false)
  const [consent, setConsent] = useState<Consent | null>(null)  // 1단계: 약관 동의 → 2단계: 가입 폼
  const supabase = createClient()
  const { lang } = useLang()
  const ko = lang !== 'en'
  const redirect = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('redirect') || '/') : '/'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      // 인증 메일 발송 문제로 임시로 서버에서 즉시 가입 처리 → 바로 로그인
      const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, consent }) })
      const json = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setError(json.error ?? (ko ? '가입에 실패했어요. 잠시 후 다시 시도해 주세요.' : 'Sign-up failed. Please try again.')); return }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); return }
      window.location.href = redirect
    })
  }
  const google = async () => {
    setOauthPending(true); setError(null)
    try { sessionStorage.setItem('vx_consent', JSON.stringify(consent)) } catch {}
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`, queryParams: { prompt: 'select_account' } } })
    if (error) { setError(error.message); setOauthPending(false) }
  }
  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : /[A-Za-z]/.test(password) && /\d/.test(password) && password.length >= 10 ? 3 : 2

  return (
    !consent ? (
    <AuthShell eyebrow="STEP 1 / 2 · AGREEMENT" title={ko ? '약관에 동의해 주세요' : 'Agree to the terms'} subtitle={ko ? '가입 전에 필수 약관을 확인하고 동의해 주세요.' : 'Please review and accept the terms before signing up.'}
      footer={<p>{ko ? '이미 계정이 있으신가요?' : 'Already have an account?'} <Link href="/login" className="font-semibold text-[#2563eb] hover:underline">{ko ? '로그인' : 'Sign in'}</Link></p>}>
      <ConsentForm onNext={setConsent} submitLabel={ko ? '동의하고 가입 진행' : 'Agree & continue'} />
    </AuthShell>
    ) : (
    <AuthShell eyebrow="STEP 2 / 2 · CREATE ACCOUNT" title={ko ? '무료로 시작하세요' : 'Start for free'} subtitle={ko ? '가입 즉시 프롬코인 30 · 게임 코인 1,000 을 드려요.' : 'Get 30 prompt coins and 1,000 game coins on sign-up.'}
      footer={<p>{ko ? '이미 계정이 있으신가요?' : 'Already have an account?'} <Link href="/login" className="font-semibold text-[#2563eb] hover:underline">{ko ? '로그인' : 'Sign in'}</Link></p>}>
      <button type="button" onClick={google} disabled={oauthPending} className="w-full h-11 rounded-xl border border-[#ddd3bf] bg-white text-[14px] font-semibold text-[#241f17] hover:bg-[#faf8f3] hover:border-[#cfc4ab] transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60">
        <GoogleIcon className="w-[18px] h-[18px]" />{oauthPending ? (ko ? 'Google 로 이동 중…' : 'Redirecting…') : (ko ? 'Google 로 계속하기' : 'Continue with Google')}
      </button>
      <div className="my-5 flex items-center gap-3 text-[11px] text-[#a1957f]"><span className="h-px flex-1 bg-[#ebe4d6]" />{ko ? '또는 이메일로' : 'or with email'}<span className="h-px flex-1 bg-[#ebe4d6]" /></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className={authLabel}>{ko ? '이메일' : 'Email'}</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" className={authInput} /></div>
        <div>
          <label className={authLabel}>{ko ? '비밀번호' : 'Password'}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" placeholder={ko ? '6자 이상' : 'At least 6 characters'} className={authInput} />
          <div className="mt-2 flex gap-1">{[1, 2, 3].map(i => <span key={i} className={`h-1 flex-1 rounded-full ${strength >= i ? (strength === 1 ? 'bg-rose-400' : strength === 2 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-[#eee7d8]'}`} />)}</div>
        </div>
        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[13px] px-3.5 py-2.5">{error}</p>}
        <button type="submit" disabled={isPending} className={authPrimary}>{isPending ? (ko ? '가입 중…' : 'Creating…') : (ko ? '가입하고 시작하기' : 'Create account')}</button>
      </form>
      <p className="mt-5 text-[11.5px] text-[#9d9280] leading-relaxed">{ko ? '약관 동의 완료' : 'Terms accepted'}{consent.marketing ? (ko ? ' · 마케팅 수신 동의' : ' · marketing opt-in') : ''} · <button type="button" onClick={() => setConsent(null)} className="underline hover:text-[#2563eb]">{ko ? '다시 보기' : 'review'}</button></p>
    </AuthShell>
    )
  )
}
