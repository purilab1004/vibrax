'use client'
// 소셜 로그인 첫 가입자 — 약관/마케팅 동의 (필수 동의 전엔 서비스 진입 안 함)
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell from '@/components/auth/AuthShell'
import ConsentForm, { type Consent } from '@/components/auth/ConsentForm'

function Inner() {
  const sp = useSearchParams(); const router = useRouter()
  const next = sp.get('next') && sp.get('next')!.startsWith('/') ? sp.get('next')! : '/'
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  const submit = async (c: Consent) => {
    setBusy(true); setErr(null)
    const r = await fetch('/api/auth/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
    if (!r.ok) { setBusy(false); setErr((await r.json().catch(() => ({}))).error ?? '실패'); return }
    try { sessionStorage.removeItem('vx_consent') } catch {}
    router.replace(next); router.refresh()
  }
  // 가입 화면에서 이미 동의하고 Google 로 넘어온 경우 자동 제출
  useEffect(() => { const t = setTimeout(() => { try { const raw = sessionStorage.getItem('vx_consent'); if (raw) { const c = JSON.parse(raw) as Consent; if (c.terms && c.privacy && c.age) submit(c) } } catch {} }, 0); return () => clearTimeout(t) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthShell eyebrow="ALMOST DONE" title="약관에 동의해 주세요" subtitle="Vibrexcup 을 시작하기 전에 필수 약관을 확인하고 동의해 주세요.">
      {err && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[13px] px-3.5 py-2.5">{err}</p>}
      <ConsentForm onNext={submit} busy={busy} submitLabel="동의하고 시작하기" />
    </AuthShell>
  )
}
export default function ConsentPage() { return <Suspense><Inner /></Suspense> }
