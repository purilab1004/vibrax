'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import { CREDIT_PACKS, packPriceId } from '@/lib/studio/constants'

export default function CreditsPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle')
  const paddleRef = useRef<Paddle | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { T } = useLang()
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
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-2">{c.heading}</h1>
      <p className="text-gray-300 text-sm mb-8">{c.subtitle}</p>

      <div className="border border-gray-800 bg-[#111] px-5 py-4 mb-10 flex items-center justify-between">
        <span className="font-pixel text-[10px] text-gray-400 tracking-widest">{c.balance}</span>
        <span className="font-pixel text-[#00ff41] text-lg tracking-widest">{balance ?? '—'}</span>
      </div>

      {status === 'processing' && (
        <p className="mb-6 text-[#00ff41] text-xs font-pixel tracking-widest animate-pulse">
          {c.processing}
        </p>
      )}
      {status === 'done' && (
        <p className="mb-6 text-[#00ff41] text-xs font-pixel tracking-widest">{c.done}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {CREDIT_PACKS.map(p => (
          <div key={p.key} className="border border-gray-800 bg-[#111] p-6 flex flex-col items-center gap-4 hover:border-[#00ff41] transition-colors">
            <span className="font-pixel text-white text-base tracking-widest">${p.usd}</span>
            <span className="text-[#00ff41] text-sm">{c.packCredits(p.credits)}</span>
            <button
              onClick={() => buy(p.key)}
              className="w-full bg-[#00ff41] text-black font-pixel text-[10px] py-3 hover:bg-[#00cc33] transition-colors tracking-widest"
            >
              {c.buy}
            </button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-500">{c.note}</p>
    </div>
  )
}
