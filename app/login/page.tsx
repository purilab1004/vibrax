'use client'

import { useState, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import AuthShell, { GoogleIcon, authInput, authLabel, authPrimary } from '@/components/auth/AuthShell'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [oauthPending, setOauthPending] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'
  const oauthErr = searchParams.get('error') === 'oauth'
  const supabase = createClient()
  const { lang } = useLang()
  const ko = lang !== 'en'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(/invalid login/i.test(error.message) ? (ko ? '이메일 또는 비밀번호가 맞지 않아요.' : 'Invalid email or password.') : error.message); return }
      router.push(redirect); router.refresh()
    })
  }
  const google = async () => {
    setOauthPending(true); setError(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`, queryParams: { prompt: 'select_account' } } })
    if (error) { setError(error.message); setOauthPending(false) }
  }

  return (
    <AuthShell eyebrow="WELCOME BACK" title={ko ? '다시 만나서 반가워요' : 'Welcome back'} subtitle={ko ? 'Vibrexcup 계정으로 로그인하세요.' : 'Sign in to your Vibrexcup account.'}
      footer={<p>{ko ? '계정이 없으신가요?' : "Don't have an account?"} <Link href={`/signup${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-semibold text-[#2563eb] hover:underline">{ko ? '무료로 가입하기' : 'Sign up free'}</Link></p>}>
      <button type="button" onClick={google} disabled={oauthPending} className="w-full h-11 rounded-xl border border-[#ddd3bf] bg-white text-[14px] font-semibold text-[#241f17] hover:bg-[#faf8f3] hover:border-[#cfc4ab] transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60">
        <GoogleIcon className="w-[18px] h-[18px]" />{oauthPending ? (ko ? 'Google 로 이동 중…' : 'Redirecting…') : (ko ? 'Google 로 계속하기' : 'Continue with Google')}
      </button>
      <div className="my-5 flex items-center gap-3 text-[11px] text-[#a1957f]"><span className="h-px flex-1 bg-[#ebe4d6]" />{ko ? '또는 이메일로' : 'or with email'}<span className="h-px flex-1 bg-[#ebe4d6]" /></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className={authLabel}>{ko ? '이메일' : 'Email'}</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" className={authInput} /></div>
        <div>
          <div className="flex items-center justify-between mb-1.5"><label className="text-[12px] font-semibold text-[#6b6152]">{ko ? '비밀번호' : 'Password'}</label><Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-[12px] font-semibold text-[#2563eb] hover:underline">{ko ? '비밀번호를 잊으셨나요?' : 'Forgot password?'}</Link></div>
          <div className="relative"><input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" className={authInput + ' pr-11'} /><button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9d9280] hover:text-[#241f17]" aria-label="toggle password">{show ? <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 12 5c5 0 9 4 10 7-.4 1.2-1.2 2.5-2.3 3.6M6.2 6.2C4.2 7.6 2.7 9.5 2 12c1 3 5 7 10 7 1.6 0 3.1-.4 4.4-1" /></svg> : <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M2 12c1-3 5-7 10-7s9 4 10 7c-1 3-5 7-10 7S3 15 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>}</button></div>
        </div>
        {(error || oauthErr) && <p className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[13px] px-3.5 py-2.5">{error ?? (ko ? 'Google 로그인에 실패했어요. 다시 시도해 주세요.' : 'Google sign-in failed. Please try again.')}</p>}
        <button type="submit" disabled={isPending} className={authPrimary}>{isPending ? (ko ? '로그인 중…' : 'Signing in…') : (ko ? '로그인' : 'Sign in')}</button>
      </form>
      <p className="mt-5 text-[11.5px] text-[#9d9280] leading-relaxed">{ko ? '로그인하면 ' : 'By continuing you agree to our '}<Link href="/terms" className="underline hover:text-[#2563eb]">{ko ? '이용약관' : 'Terms'}</Link>{ko ? '과 ' : ' and '}<Link href="/privacy" className="underline hover:text-[#2563eb]">{ko ? '개인정보처리방침' : 'Privacy Policy'}</Link>{ko ? '에 동의하는 것으로 봅니다.' : '.'}</p>
    </AuthShell>
  )
}

export default function LoginPage() { return <Suspense><LoginForm /></Suspense> }
