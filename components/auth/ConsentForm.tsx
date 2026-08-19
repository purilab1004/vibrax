'use client'
// 약관 동의 스텝 — 전체 동의 / 필수(이용약관·개인정보·만 14세) / 선택(마케팅)
import { useState } from 'react'
import Link from 'next/link'
import { authPrimary } from '@/components/auth/AuthShell'

export interface Consent { terms: boolean; privacy: boolean; age: boolean; marketing: boolean }
export default function ConsentForm({ onNext, busy, submitLabel = '동의하고 계속' }: { onNext: (c: Consent) => void; busy?: boolean; submitLabel?: string }) {
  const [c, setC] = useState<Consent>({ terms: false, privacy: false, age: false, marketing: false })
  const all = c.terms && c.privacy && c.age && c.marketing
  const required = c.terms && c.privacy && c.age
  const row = (key: keyof Consent, label: React.ReactNode, req: boolean) => (
    <label className="flex items-start gap-3 py-3 cursor-pointer">
      <input type="checkbox" checked={c[key]} onChange={e => setC({ ...c, [key]: e.target.checked })} className="mt-0.5 w-4.5 h-4.5 accent-[#2563eb]" />
      <span className="text-[13.5px] text-[#241f17] leading-snug"><span className={`mr-1.5 text-[11px] font-bold ${req ? 'text-[#2563eb]' : 'text-[#9d9280]'}`}>[{req ? '필수' : '선택'}]</span>{label}</span>
    </label>
  )
  return (
    <div>
      <label className="flex items-center gap-3 rounded-xl border border-[#ddd3bf] bg-[#faf8f3] px-4 py-3 cursor-pointer">
        <input type="checkbox" checked={all} onChange={e => { const v = e.target.checked; setC({ terms: v, privacy: v, age: v, marketing: v }) }} className="w-5 h-5 accent-[#2563eb]" />
        <span className="text-[15px] font-bold text-[#241f17]">전체 동의</span><span className="text-[12px] text-[#857a68]">선택 항목 포함</span>
      </label>
      <div className="mt-2 divide-y divide-[#f0eadf] px-1">
        {row('terms', <><Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-[#2563eb]">이용약관</Link>에 동의합니다</>, true)}
        {row('privacy', <><Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-[#2563eb]">개인정보 수집·이용</Link>에 동의합니다</>, true)}
        {row('age', <>만 14세 이상입니다</>, true)}
        {row('marketing', <>이벤트·혜택·신작 소식 등 마케팅 정보 수신에 동의합니다 <span className="text-[#9d9280]">(이메일)</span></>, false)}
      </div>
      <button type="button" disabled={!required || busy} onClick={() => onNext(c)} className={authPrimary + ' mt-5'}>{busy ? '처리 중…' : submitLabel}</button>
      {!required && <p className="mt-2 text-[11.5px] text-[#9d9280] text-center">필수 항목에 모두 동의해야 계속할 수 있어요.</p>}
    </div>
  )
}
