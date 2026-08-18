'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import { CREDIT_PACKS, packPriceId } from '@/lib/studio/constants'
import { PromptCreditIcon } from '@/components/CurrencyBadge'

// Paddle 미설정(키/가격 ID 없음)이면 구매 버튼 대신 준비 중 안내를 보여준다
const paddleConfigured =
  !!process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN && CREDIT_PACKS.every(p => packPriceId(p.key))

export default function CreditsPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const paddleRef = useRef<Paddle | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { T, lang } = useLang()
  const c = T.credits

  const refreshBalance = async () => {
    const { data } = await supabase.rpc('credit_balance' as never)
    const n = typeof data === 'number' ? data : 0
    setBalance(n)
    return n
  }

  // eventCallback 클로저에서 최신 잔액을 읽기 위한 ref
  const balanceRef = useRef<number | null>(null)
  useEffect(() => { balanceRef.current = balance }, [balance])

  // 결제 완료 후 잔액 폴링 타이머 — 언마운트/중복 이벤트 시 정리
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }
  useEffect(() => stopPolling, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/login?redirect=/credits')
        return
      }
      setUserId(user.id)
      await refreshBalance()
    })

    if (!paddleConfigured) return
    initializePaddle({
      environment:
        process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!,
      eventCallback: event => {
        if (event.name === 'checkout.error') setStatus('error')
        if (event.name === 'checkout.completed') {
          setStatus('processing')
          // 웹훅 지급이 반영될 때까지 짧게 폴링 (중복 이벤트 시 기존 타이머 교체)
          stopPolling()
          const before = balanceRef.current ?? 0
          let tries = 0
          pollTimerRef.current = setInterval(async () => {
            tries += 1
            const now = await refreshBalance()
            if (now > before || tries >= 10) {
              stopPolling()
              setStatus(now > before ? 'done' : 'idle')
            }
          }, 2000)
        }
      },
    }).then(p => {
      if (p) paddleRef.current = p
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buy = (key: 'small' | 'medium' | 'large') => {
    const priceId = packPriceId(key)
    if (!priceId || !paddleRef.current || !userId) return
    paddleRef.current.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: { user_id: userId },
      // 사이트 언어(KO/EN)와 결제창 언어 동기화 — 그 외 언어는 Paddle이 브라우저 기준 자동 감지
      settings: { locale: lang },
    })
  }

  const perCredit = (p: { usd: number; credits: number }) => (p.usd / p.credits * 100).toFixed(1)  // ¢/credit
  const base = CREDIT_PACKS[0]
  const bonusPct = (p: { usd: number; credits: number }) => Math.round((p.credits / (p.usd * (base.credits / base.usd)) - 1) * 100)
  const [genCost, setGenCost] = useState(10)
  useEffect(() => { supabase.from('site_settings').select('value').eq('key', 'generation_cost').maybeSingle().then(({ data }) => { const v = Number((data as { value?: unknown } | null)?.value); if (Number.isFinite(v) && v >= 1) setGenCost(v) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const gens = (p: { credits: number }) => Math.floor(p.credits / genCost)
  const gamesOf = (p: { credits: number }) => Math.max(1, Math.floor(p.credits / (genCost * 5)))  // 게임 1개 ≈ 생성 1회 + 수정 4회
  const [history, setHistory] = useState<{ id: string; created_at: string; amount_minor: number | null; currency: string | null; credits: number; status: string }[] | null>(null)
  useEffect(() => {
    if (!userId) return
    supabase.from('payments').select('id,created_at,amount_minor,currency,credits,status').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setHistory((data as typeof history) ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])
  const money = (minor: number | null, cur: string | null) => minor == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: cur ?? 'USD' }).format(minor / 100)

  return (
    <div className="relative overflow-hidden">
      {/* 배경 오로라 */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.18),rgba(6,182,212,0.10),transparent)] blur-2xl" />
      <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-16">
        {/* 헤더 + 잔액 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <p className="font-pixel text-[11px] tracking-[0.3em] text-[#2563eb]">CREDITS</p>
            <h1 className="mt-2 text-[32px] md:text-[42px] font-extrabold tracking-tight text-[#241f17] leading-tight">크레딧을 충전하고<br className="hidden md:block" /> <span className="bg-gradient-to-r from-[#2563eb] to-[#06b6d4] bg-clip-text text-transparent">아이디어를 게임으로</span></h1>
            <p className="mt-3 text-[14px] text-[#6b6152]"><PromptCreditIcon className="inline w-4 h-4 align-[-2px] mr-1" /><b>프롬프트 크레딧</b>은 스튜디오에서 게임을 만들 때 써요 — 생성·수정 1회 = {genCost} 크레딧, 템플릿 로드도 {genCost}. 실패한 생성은 자동 환불. (게임을 플레이할 때 쓰는 <b className="text-[#8a5a00]">게임 코인</b>과는 별개예요.)</p>
          </div>
          <div className="shrink-0 rounded-2xl p-[1.5px] bg-gradient-to-br from-[#2563eb] to-[#06b6d4] shadow-[0_16px_40px_-16px_rgba(37,99,235,0.45)]">
            <div className="rounded-[14.5px] bg-white px-6 py-5 min-w-[220px]">
              <p className="text-[11px] font-semibold text-[#3b6fd8] tracking-wide flex items-center gap-1.5"><PromptCreditIcon className="w-3.5 h-3.5" />보유 프롬프트 크레딧</p>
              <p className="mt-1 text-[36px] leading-none font-extrabold tracking-tight text-[#241f17]">{balance ?? '—'}</p>
              <p className="mt-2 text-[11.5px] text-[#9d9280]">≈ 생성·수정 {balance != null ? Math.floor(balance / genCost) : '—'}회 · 완성 게임 약 {balance != null ? Math.floor(balance / (genCost * 5)) : '—'}개</p>
            </div>
          </div>
        </div>

        {!paddleConfigured && <p className="mb-6 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">{c.notReady}</p>}
        {status === 'processing' && <p className="mb-6 rounded-xl border border-[#2563eb]/30 bg-[#2563eb]/5 text-[#2563eb] text-[13px] px-4 py-3 animate-pulse">{c.processing}</p>}
        {status === 'done' && <p className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-[13px] px-4 py-3">{c.done}</p>}
        {status === 'error' && <p className="mb-6 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-[13px] px-4 py-3">결제창을 여는 중 문제가 생겼어요. 잠시 후 다시 시도하거나 dev@puritechlab.com 으로 알려주세요.</p>}

        {/* 팩 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CREDIT_PACKS.map((p, i) => {
            const popular = i === 1
            const bonus = bonusPct(p)
            return (
              <div key={p.key} className={`relative rounded-3xl p-[1.5px] ${popular ? 'bg-gradient-to-b from-[#2563eb] to-[#06b6d4] shadow-[0_24px_60px_-24px_rgba(37,99,235,0.6)] md:-translate-y-2' : 'bg-[#ebe4d6]'}`}>
                {popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#241f17] text-white text-[11px] font-bold px-3 py-1 tracking-wide">가장 인기</span>}
                <div className="rounded-[22.5px] bg-white p-6 md:p-7 h-full flex flex-col">
                  <p className="text-[12px] font-semibold text-[#857a68] tracking-wide uppercase">{p.key === 'small' ? 'Starter' : p.key === 'medium' ? 'Creator' : 'Studio'}</p>
                  <div className="mt-2 flex items-end gap-1"><span className="text-[40px] leading-none font-extrabold tracking-tight text-[#241f17]">${p.usd}</span><span className="text-[13px] text-[#9d9280] mb-1.5">1회 결제</span></div>
                  <p className="mt-3 text-[18px] font-bold text-[#2563eb]">{p.credits.toLocaleString()} 크레딧{bonus > 0 && <span className="ml-2 align-middle rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-0.5">+{bonus}% 보너스</span>}</p>
                  <ul className="mt-4 space-y-2 text-[13px] text-[#4a4337]">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />생성·수정 <b>{gens(p)}회</b> (1회 {genCost} 크레딧)</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />완성 게임 약 <b>{gamesOf(p)}개</b> <span className="text-[#9d9280] text-[11.5px]">(생성1+수정4)</span></li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />크레딧당 {perCredit(p)}¢</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />유효기간 없음 · 실패 시 자동 환불</li>
                  </ul>
                  <button onClick={() => buy(p.key)} disabled={!paddleConfigured}
                    className={`mt-6 h-11 rounded-xl text-[14px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${popular ? 'bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white shadow-[0_8px_20px_rgba(37,99,235,0.35)] hover:shadow-[0_10px_26px_rgba(37,99,235,0.45)]' : 'bg-[#241f17] text-white hover:bg-[#3a332a]'}`}>
                    {c.buy}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* 신뢰 배지 */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-[#857a68]">
          <span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>Paddle 안전 결제 · 카드 / PayPal / Apple Pay</span>
          <span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 24 24" className="w-4 h-4 text-[#2563eb]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 6v6l4 2" /><circle cx="12" cy="12" r="9" /></svg>결제 즉시 자동 지급</span>
          <span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 24 24" className="w-4 h-4 text-[#2563eb]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5" /><path d="M18 3v4h-4M6 21v-4h4" /></svg>14일 내 미사용 시 전액 환불</span>
          <a href="/refund" className="underline underline-offset-2 hover:text-[#2563eb]">환불 정책</a>
        </div>

        {/* 결제 내역 */}
        <section className="mt-12">
          <h2 className="text-[15px] font-bold text-[#241f17] mb-3">결제 내역</h2>
          <div className="rounded-2xl border border-[#ebe4d6] bg-white overflow-hidden">
            {history === null ? <p className="p-5 text-[13px] text-[#9d9280]">불러오는 중…</p> : history.length === 0 ? <p className="p-6 text-[13px] text-[#9d9280] text-center">아직 결제 내역이 없어요.</p> : (
              <ul className="divide-y divide-[#f0eadf]">
                {history.map(h => (
                  <li key={h.id} className="flex items-center gap-4 px-5 py-3.5 text-[13px]">
                    <span className="text-[#857a68] whitespace-nowrap">{new Date(h.created_at).toLocaleDateString()}</span>
                    <span className="flex-1 font-semibold text-[#241f17]">+{h.credits.toLocaleString()} 크레딧</span>
                    <span className="tabular-nums text-[#4a4337]">{money(h.amount_minor, h.currency)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${h.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : h.status.startsWith('refund') ? 'bg-rose-50 text-rose-600' : 'bg-[#f1ece2] text-[#6b6152]'}`}>{h.status === 'completed' ? '완료' : h.status === 'refunded' ? '환불' : h.status === 'refund_pending' ? '환불 검토' : h.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
