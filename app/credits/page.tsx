'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import { CREDIT_PACKS, packPriceId } from '@/lib/studio/constants'

// Paddle 미설정(키/가격 ID 없음)이면 구매 버튼 대신 준비 중 안내를 보여준다
const paddleConfigured =
  !!process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN && CREDIT_PACKS.every(p => packPriceId(p.key))

export default function CreditsPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle')
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

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#2563eb] text-sm tracking-widest mb-2">{c.heading}</h1>
      <p className="text-[#4a4337] text-sm mb-8">{c.subtitle}</p>

      <div className="border border-[#ebe4d6] bg-[#ffffff] px-5 py-4 mb-10 flex items-center justify-between">
        <span className="font-pixel text-[11px] text-[#6b6152] tracking-widest">{c.balance}</span>
        <span className="font-pixel text-[#2563eb] text-lg tracking-widest">{balance ?? '—'}</span>
      </div>

      {!paddleConfigured && (
        <p className="mb-6 text-yellow-400 text-xs border border-yellow-900 bg-yellow-900/20 px-3 py-2.5">
          {c.notReady}
        </p>
      )}
      {status === 'processing' && (
        <p className="mb-6 text-[#2563eb] text-xs font-pixel tracking-widest animate-pulse">
          {c.processing}
        </p>
      )}
      {status === 'done' && (
        <p className="mb-6 text-[#2563eb] text-xs font-pixel tracking-widest">{c.done}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {CREDIT_PACKS.map(p => (
          <div key={p.key} className="border border-[#ebe4d6] bg-[#ffffff] p-6 flex flex-col items-center gap-4 hover:border-[#2563eb] transition-colors">
            <span className="font-pixel text-[#241f17] text-base tracking-widest">${p.usd}</span>
            <span className="text-[#2563eb] text-sm">{c.packCredits(p.credits)}</span>
            <button
              onClick={() => buy(p.key)}
              disabled={!paddleConfigured}
              className="w-full bg-[#2563eb] text-[#241f17] font-pixel text-[11px] py-3 hover:bg-[#1d4ed8] transition-colors tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {c.buy}
            </button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[#857a68]">{c.note}</p>
    </div>
  )
}
