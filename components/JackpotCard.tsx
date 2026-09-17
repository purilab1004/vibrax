'use client'
// 코인 잭팟(랜덤 뽑기) 카드 — 쇼츠 피드에 게임 사이로 끼어든다. 관리자만 만들 수 있고, 회원은 코인을 내고 참여.
// 마감 뒤 추첨 → 당첨자가 모인 코인을 모두 가져간다. 코인은 나중에 실제 상품 구매에도 쓴다.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { titleFont } from '@/lib/fonts'
import { useIsNativeApp } from '@/lib/isNativeApp'
import CardRail from '@/components/CardRail'

export interface Jackpot { id: string; title: string; description: string | null; image_url: string | null; entry_cost: number; ends_at: string; status: string; pool: number; entries: number }
export interface Product { id: string; title: string; description: string | null; image_url: string | null; coin_price: number }

function useCountdown(endsAt: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])
  const ms = Math.max(0, new Date(endsAt).getTime() - now)
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000)
  return { ms, text: d > 0 ? `${d}일 ${h}시간 ${m}분` : h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초` }
}

export default function JackpotCard({ jackpot, products, mine = 0, layout }: { jackpot: Jackpot; products: Product[]; mine?: number; layout: 'feed-mobile' | 'feed-desktop' }) {
  const router = useRouter()
  const isApp = useIsNativeApp()
  const { ms, text } = useCountdown(jackpot.ends_at)
  const [pool, setPool] = useState(jackpot.pool)
  const [entries, setEntries] = useState(jackpot.entries)
  const [myCount, setMyCount] = useState(mine)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const closed = ms <= 0 || jackpot.status !== 'open'

  const enter = async () => {
    if (busy || closed) return
    const { data: { session } } = await createClient().auth.getSession()
    if (!session?.user) { router.push('/login?redirect=/games'); return }
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/jackpots/${jackpot.id}/enter`, { method: 'POST' })
      const j = await r.json()
      if (!r.ok) { setMsg(j.error ?? '참여 실패'); return }
      setPool((p) => p + jackpot.entry_cost); setEntries((e) => e + 1); setMyCount((c) => c + 1)
      setMsg(`참여 완료! 남은 코인 ${Number(j.balance).toLocaleString()}`)
      window.dispatchEvent(new CustomEvent('vcoin:changed', { detail: { balance: j.balance } }))
    } catch { setMsg('네트워크 오류') } finally { setBusy(false); setConfirm(false) }
  }

  const inner = (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #3b1d7a 0%, #1a0f3f 45%, #0a0619 100%)' }}>
      {/* 배경 이미지(상품/잭팟) 흐리게 */}
      {jackpot.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={jackpot.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'blur(18px) saturate(1.2)', transform: 'scale(1.15)', opacity: 0.45 }} />
      )}
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.55) 1px, transparent 1.5px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
      {/* 상단 배지 */}
      <div className="absolute top-4 left-4 right-16 z-10 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f59e0b] text-[#3a2500] font-pixel text-[10px] px-2.5 py-1 tracking-widest shadow">🎰 JACKPOT</span>
        <span className="inline-flex items-center rounded-full bg-black/45 backdrop-blur px-2.5 py-1 text-white text-[11px] font-semibold">{closed ? '마감' : `⏳ ${text} 남음`}</span>
      </div>
      {/* 본문 */}
      <div className="absolute inset-x-0 top-[13%] px-6 text-center z-[5]">
        <h3 className={`${titleFont.className} text-[34px] leading-[1.2] text-white drop-shadow-[0_3px_8px_rgba(0,0,0,.6)]`} style={{ wordBreak: 'keep-all' }}>{jackpot.title}</h3>
        {jackpot.description && <p className="mt-2 text-[13px] text-white/85 leading-snug line-clamp-2" style={{ wordBreak: 'keep-all' }}>{jackpot.description}</p>}
      </div>
      {/* 코인 풀 */}
      <div className="absolute inset-x-0 top-[34%] flex flex-col items-center z-[5]">
        {jackpot.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={jackpot.image_url} alt="" className="w-[42%] max-w-[180px] aspect-square object-cover rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,.5)] ring-2 ring-white/20 mb-3" />
        ) : <span className="text-[72px] leading-none mb-2 drop-shadow-[0_8px_20px_rgba(0,0,0,.5)]">🪙</span>}
        <p className="text-[11px] tracking-[0.3em] text-[#ffd166] font-bold">모인 코인</p>
        <p className={`${titleFont.className} text-[46px] leading-none text-white mt-1 tabular-nums drop-shadow-[0_4px_12px_rgba(245,158,11,.5)]`}>{pool.toLocaleString()}</p>
        <p className="mt-1.5 text-[12px] text-white/75">참여 {entries.toLocaleString()}명{myCount > 0 ? ` · 내 참여 ${myCount}장` : ''} · 당첨 1명이 전부 가져가요</p>
      </div>
      {/* 상품 */}
      {products.length > 0 && (
        <div className="absolute inset-x-0 bottom-[30%] px-5 z-[5]">
          <p className="text-[10.5px] tracking-[0.2em] text-white/60 font-bold mb-1.5">코인으로 살 수 있는 상품</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {products.slice(0, 6).map((p) => (
              <div key={p.id} className="shrink-0 w-[92px] rounded-xl bg-white/10 backdrop-blur border border-white/15 p-1.5">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.title} className="w-full aspect-square object-cover rounded-lg" />
                ) : <div className="w-full aspect-square rounded-lg bg-white/10 flex items-center justify-center text-xl">🎁</div>}
                <p className="mt-1 text-[10.5px] text-white truncate">{p.title}</p>
                <p className="text-[10px] text-[#ffd166] font-bold">🪙 {p.coin_price.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 하단 — 참여 버튼 */}
      <div className={`absolute inset-x-0 bottom-0 z-10 px-5 pt-14 bg-gradient-to-t from-black/80 via-black/40 to-transparent ${layout === 'feed-mobile' ? (isApp ? 'pb-28' : 'pb-24') : 'pb-6'}`}>
        {msg && <p className="mb-2 text-[12.5px] text-[#ffd166] font-semibold text-center">{msg}</p>}
        {confirm ? (
          <div className="flex items-center gap-2">
            <button onClick={enter} disabled={busy} className={`flex-1 h-[52px] ${titleFont.className} text-[19px] rounded-full bg-gradient-to-b from-[#ffd94f] to-[#ffb62e] text-[#3a2c00] shadow-[0_5px_0_#d18f00,0_9px_16px_rgba(0,0,0,0.35)] disabled:opacity-60`}>{busy ? '참여 중…' : `🪙 ${jackpot.entry_cost} 코인 내고 참여`}</button>
            <button onClick={() => setConfirm(false)} className="h-[52px] px-4 rounded-full bg-white/15 text-white text-[14px] font-bold">취소</button>
          </div>
        ) : (
          <button onClick={() => (closed ? null : setConfirm(true))} disabled={closed} className={`w-full h-[52px] ${titleFont.className} text-[20px] rounded-full ${closed ? 'bg-white/15 text-white/60' : 'bg-gradient-to-b from-[#ffd94f] to-[#ffb62e] text-[#3a2c00] shadow-[0_5px_0_#d18f00,0_9px_16px_rgba(0,0,0,0.35)]'}`}>
            {closed ? '마감됐어요' : `🎰 ${jackpot.entry_cost} 코인으로 도전`}
          </button>
        )}
        <p className="mt-2 text-center text-[10.5px] text-white/55">참여 코인은 환불되지 않아요 · 마감 후 참여 코인만큼 확률로 추첨</p>
      </div>
    </div>
  )

  if (layout === 'feed-desktop') {
    return (
      <div className="h-full snap-start [scroll-snap-stop:always] flex items-center justify-center gap-5">
        <div className="relative h-[96%] aspect-[9/15] rounded-2xl overflow-hidden shadow-[0_18px_60px_rgba(36,31,23,0.22)]">{inner}</div>
        <CardRail name="VIBREXCUP" color="#FFD166" shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/games` : undefined} stats={[
          { icon: <span className="text-[18px]">🪙</span>, label: pool.toLocaleString() },
          { icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M2.8 19c.6-3.3 3-5 6.2-5s5.6 1.7 6.2 5" /><circle cx="17" cy="9" r="2.6" /><path d="M15.5 14.2c3 .2 5 1.8 5.6 4.8" /></svg>, label: `${entries}명` },
        ]} />
      </div>
    )
  }
  return <div className="feed-snap relative h-[100svh] overflow-hidden bg-[#0a0619]">{inner}</div>
}
