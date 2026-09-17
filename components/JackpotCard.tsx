'use client'
// 코인 잭팟(랜덤 뽑기) 카드 — 쇼츠 피드에 게임 사이로 끼어든다. 관리자만 만들 수 있고, 회원은 토큰동전(크레딧)을 내고 참여. 쇼츠 문구는 모두 '토큰동전'.
//  · 대표 이미지는 가운데에서 레인보우 햇살 광휘와 함께 빛난다 (없으면 ✦)
//  · 상품이 걸린 잭팟: 추첨 전엔 "이번 상품 : 상품이 등록되었습니다!" + 닫힌 판도라 박스, 조건 금액 진행 바
//  · 추첨(당첨 발표) 뒤엔 판도라 박스가 흔들리다 열리며 상품 썸네일이 빛과 함께 솟아오른다 + 당첨자 목록
//  · 상금(크레딧·상품)은 관리자가 당첨자 목록에서 직접 수여
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { titleFont } from '@/lib/fonts'
import { useIsNativeApp } from '@/lib/isNativeApp'
import CardRail from '@/components/CardRail'
import { playCoinSound } from '@/components/GameCard'

export interface Jackpot {
  id: string; title: string; description: string | null; image_url: string | null; entry_cost: number; ends_at: string; status: string; pool: number; entries: number
  drawn_at?: string | null
  winner_count?: number
  has_product?: boolean
  product_threshold?: number
  product?: { title: string; description: string | null; image_url: string | null } | null
  product_won?: boolean
  winners?: { rank: number; name: string; prize: string }[]
}

function useCountdown(endsAt: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])
  const ms = Math.max(0, new Date(endsAt).getTime() - now)
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000)
  return { ms, text: d > 0 ? `${d}일 ${h}시간 ${m}분` : h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초` }
}

// 레인보우 광선 — 24갈래, 갈래마다 색상환을 한 바퀴 돈다
const RAINBOW_RAYS = `conic-gradient(from 0deg, ${Array.from({ length: 24 }, (_, i) => { const a = i * 15; return `hsla(${i * 15} 100% 68% / .95) ${a}deg ${a + 6}deg, transparent ${a + 6}deg ${a + 15}deg` }).join(', ')})`
const RAY_MASK = 'radial-gradient(circle, #000 0%, #000 18%, rgba(0,0,0,.55) 38%, transparent 62%)'
const center = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' } as const

/** 햇살처럼 강하게 빛나는 레인보우 광휘 — 부모(relative) 가운데에 깔린다 */
function Radiance({ scale = 1 }: { scale?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* 무지개 원판(흐림) — 회전하며 색이 돈다 */}
      <div className="absolute jp-spin-fast rounded-full" style={{ ...center, width: `${62 * scale}%`, aspectRatio: '1', background: 'conic-gradient(#ff5e5e, #ffb84d, #fff45c, #6dff8a, #5ce1ff, #7a7dff, #e36bff, #ff5e5e)', filter: 'blur(26px)', opacity: 0.85 }} />
      {/* 레인보우 광선 */}
      <div className="absolute jp-spin" style={{ ...center, width: `${135 * scale}%`, aspectRatio: '1', background: RAINBOW_RAYS, WebkitMaskImage: RAY_MASK, maskImage: RAY_MASK, mixBlendMode: 'screen' }} />
      {/* 흰 광선(반대로) — 햇빛 느낌 */}
      <div className="absolute jp-spin-rev" style={{ ...center, width: `${115 * scale}%`, aspectRatio: '1', background: 'repeating-conic-gradient(from 7deg, rgba(255,255,255,.9) 0deg 2.2deg, transparent 2.2deg 18deg)', WebkitMaskImage: RAY_MASK, maskImage: RAY_MASK, mixBlendMode: 'screen' }} />
      {/* 중심 발광 */}
      <div className="absolute jp-bloom rounded-full" style={{ ...center, width: `${58 * scale}%`, aspectRatio: '1', background: 'radial-gradient(circle, #fff 0%, #fffbe0 18%, rgba(255,226,140,.85) 34%, rgba(255,150,210,.35) 52%, transparent 70%)', mixBlendMode: 'screen' }} />
      {/* 반짝이 */}
      {[[14, 22, 0], [82, 18, .5], [8, 70, 1], [88, 64, .3], [30, 8, 1.3], [66, 88, .8], [50, 2, 1.6], [20, 92, .2]].map(([x, y, d], i) => (
        <span key={i} className="absolute jp-twinkle text-white" style={{ left: `${x}%`, top: `${y}%`, fontSize: i % 2 ? 14 : 20, animationDelay: `${d}s`, textShadow: '0 0 8px #fff, 0 0 16px #ffd166' }}>✦</span>
      ))}
    </div>
  )
}

/** 판도라 박스 — 화면에 들어오면 흔들리다 열리고 상품이 솟아오른다 */
function PandoraReveal({ product, active }: { product: NonNullable<Jackpot['product']>; active: boolean }) {
  const [phase, setPhase] = useState<'closed' | 'shake' | 'open'>('closed')
  useEffect(() => {
    if (!active) return
    const a = setTimeout(() => setPhase((p) => (p === 'closed' ? 'shake' : p)), 250)
    const b = setTimeout(() => setPhase('open'), 1150)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [active])
  const open = phase === 'open'
  return (
    <div className="relative w-full h-full">
      {open && <Radiance scale={1.1} />}
      {open && <div className="absolute inset-0 jp-flash pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 55%, #fff 0%, rgba(255,255,255,.7) 30%, transparent 65%)' }} />}
      {/* 상품 썸네일 — 박스에서 솟아오른다 */}
      {open && (
        <div className="absolute jp-rise z-[3]" style={{ left: '50%', top: '0%', height: '62%', maxWidth: '72%', aspectRatio: '1' }}>
          <div className="jp-float w-full h-full flex items-center justify-center">
            {product.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={product.image_url} alt={product.title} className="max-w-full max-h-full object-contain jp-glow-img" />
              : <span className="text-[84px] jp-glow-img">🎁</span>}
          </div>
        </div>
      )}
      {open && Array.from({ length: 12 }, (_, i) => { const ang = (i / 12) * Math.PI * 2; return (
        <span key={i} className="absolute jp-burst text-[#fff6c8] z-[4]" style={{ left: '50%', top: '62%', fontSize: 16 + (i % 3) * 6, ['--dx' as string]: `${Math.cos(ang) * 140}px`, ['--dy' as string]: `${Math.sin(ang) * 120 - 30}px`, textShadow: '0 0 10px #fff, 0 0 18px #ffb84d' } as React.CSSProperties}>✦</span>
      ) })}
      {/* 박스 */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center z-[2]" style={{ height: open ? '46%' : '72%', transition: 'height .4s ease' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={open ? 'o' : 'c'} src={open ? '/jackpot/box-open.webp' : '/jackpot/box-closed.webp'} alt="판도라 박스" className={`h-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,.5)] ${phase === 'shake' ? 'jp-shake' : open ? 'jp-box-open' : 'jp-wiggle'}`} />
      </div>
    </div>
  )
}

export default function JackpotCard({ jackpot, mine = 0, layout }: { jackpot: Jackpot; mine?: number; layout: 'feed-mobile' | 'feed-desktop' | 'preview' }) {
  const router = useRouter()
  const isApp = useIsNativeApp()
  const { ms, text } = useCountdown(jackpot.ends_at)
  const [pool, setPool] = useState(jackpot.pool)
  const [entries, setEntries] = useState(jackpot.entries)
  const [myCount, setMyCount] = useState(mine)
  const [coinState, setCoinState] = useState<'idle' | 'drop' | 'done'>('idle')
  const coinLock = useRef(false)
  const [msg, setMsg] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = rootRef.current; if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold: 0.55 })
    io.observe(el); return () => io.disconnect()
  }, [])

  const drawn = jackpot.status === 'drawn'
  const closed = ms <= 0 || jackpot.status !== 'open'
  const winnerCount = Math.max(1, jackpot.winner_count ?? 1)
  const threshold = jackpot.product_threshold ?? 0
  const hasProduct = !!jackpot.has_product
  const reveal = drawn && !!jackpot.product
  const reached = pool > threshold

  // 게임 쇼츠와 같은 코인 투입 — 한 번 탭하면 동전이 슬롯에 들어가며 바로 참여(확인 버튼 없음). 여러 번 넣을 수 있다
  const insertCoin = async () => {
    if (coinLock.current || coinState === 'drop' || closed || layout === 'preview') return
    coinLock.current = true
    setCoinState('drop'); setMsg(null)
    playCoinSound()   // 탭 제스처 안에서 즉시 — iOS 재생 차단 방지
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session?.user) { setCoinState('idle'); router.push('/login?redirect=/games'); return }
      const r = await fetch(`/api/jackpots/${jackpot.id}/enter`, { method: 'POST' })
      const j = await r.json()
      if (!r.ok) { setMsg(j.error ?? '참여 실패'); setCoinState('idle'); return }
      setPool((p) => p + jackpot.entry_cost); setEntries((e) => e + 1); setMyCount((c) => c + 1)
      setMsg(`참여 완료! 남은 토큰동전 ${Number(j.balance).toLocaleString()}`)
      window.dispatchEvent(new CustomEvent('credits:changed', { detail: { balance: j.balance } }))
      setTimeout(() => setCoinState('done'), 700)
      setTimeout(() => setCoinState('idle'), 2200)
    } catch { setMsg('네트워크 오류'); setCoinState('idle') } finally { coinLock.current = false }
  }

  const statusBadge = drawn ? '🎉 당첨 발표' : closed ? '마감 · 추첨 대기' : `⏳ ${text} 남음`
  const winners = jackpot.winners ?? []

  const inner = (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden flex flex-col" style={{ background: 'radial-gradient(120% 80% at 50% 38%, #4a2394 0%, #1f1048 48%, #0a0619 100%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.55) 1px, transparent 1.5px)', backgroundSize: '80px 80px', opacity: 0.45 }} />
      {/* 상단 배지 */}
      <div className="relative z-10 shrink-0 pt-4 pl-4 pr-16 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f59e0b] text-[#3a2500] font-pixel text-[10px] px-2.5 py-1 tracking-widest shadow">🎰 JACKPOT</span>
        <span className="inline-flex items-center rounded-full bg-black/45 backdrop-blur px-2.5 py-1 text-white text-[11px] font-semibold">{statusBadge}</span>
      </div>

      <div className={`relative z-[5] flex-1 min-h-0 flex flex-col items-center px-5 ${layout === 'feed-mobile' ? 'pt-[9svh]' : 'pt-3'}`}>
        {/* 제목 크게 */}
        <h3 className={`${titleFont.className} shrink-0 text-center text-[clamp(34px,9.5vw,46px)] leading-[1.12] text-white`} style={{ wordBreak: 'keep-all', textShadow: '0 2px 0 #2a1160, 0 4px 14px rgba(0,0,0,.75), 0 0 22px rgba(255,209,102,.55)' }}>{jackpot.title}</h3>
        {jackpot.description && <p className="shrink-0 mt-1.5 text-center text-[13.5px] text-white/90 leading-snug line-clamp-3" style={{ wordBreak: 'keep-all', textShadow: '0 1px 6px rgba(0,0,0,.8)' }}>{jackpot.description}</p>}

        {/* 가운데 — 빛나는 대표 이미지 / 추첨 뒤 판도라 박스 공개 */}
        <div className="relative flex-1 min-h-[120px] w-full my-1">
          {reveal ? <PandoraReveal product={jackpot.product!} active={inView} /> : (
            <>
              <Radiance />
              <div className="absolute inset-y-[14%] inset-x-[20%] flex items-center justify-center jp-float">
                {jackpot.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={jackpot.image_url} alt="" className="max-w-full max-h-full object-contain jp-glow-img" />
                  : <span className="text-[96px] leading-none text-[#ffd166] jp-glow-img">✦</span>}
              </div>
            </>
          )}
        </div>

        {/* 모인 크레딧 */}
        <div className="relative z-[6] shrink-0 flex flex-col items-center" style={{ textShadow: '0 1px 6px rgba(0,0,0,.8)' }}>
          <p className="text-[10.5px] tracking-[0.3em] text-[#ffd166] font-bold">모인 토큰동전</p>
          <p className={`${titleFont.className} text-[38px] leading-none text-white mt-0.5 tabular-nums`} style={{ textShadow: '0 0 16px rgba(245,158,11,.7)' }}>✦ {pool.toLocaleString()}</p>
          <p className="mt-1 text-[12px] text-white/75">참여 {entries.toLocaleString()}명{myCount > 0 ? ` · 내 참여 ${myCount}장` : ''} · 당첨 {winnerCount}명</p>
        </div>

        {/* 상품 안내 */}
        {hasProduct && (
          <div className="shrink-0 mt-2 w-full max-w-[360px] rounded-2xl bg-white/10 backdrop-blur border border-white/20 px-3 py-2 flex items-center gap-2.5">
            {!drawn && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/jackpot/box-closed.webp" alt="" className="w-11 h-11 object-contain jp-wiggle shrink-0" />
            )}
            {reveal && jackpot.product?.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={jackpot.product.image_url} alt="" className="w-11 h-11 object-contain shrink-0 jp-glow-img" />
            )}
            <div className="min-w-0 flex-1">
              {reveal ? (
                <>
                  <p className={`${titleFont.className} text-[16px] leading-tight jp-rainbow-text truncate`}>이번 상품 : {jackpot.product!.title}</p>
                  <p className="text-[11px] text-white/80 mt-0.5">{jackpot.product_won ? '🎉 조건 달성! 당첨자에게 상품이 나갑니다' : `조건(✦ ${threshold.toLocaleString()} 초과) 미달 — 토큰동전으로 지급해요`}</p>
                </>
              ) : (
                <>
                  <p className={`${titleFont.className} text-[16px] leading-tight jp-rainbow-text`}>이번 상품 : 상품이 등록되었습니다!</p>
                  {threshold > 0 ? (
                    <>
                      <p className="text-[11px] text-white/80 mt-0.5">잭팟 ✦ {threshold.toLocaleString()} 초과 시 당첨자에게 상품 지급 {reached && <b className="text-[#7dff8a]">· 달성!</b>}</p>
                      <div className="mt-1 h-1.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#ffd166] via-[#ff7ad9] to-[#6bd6ff]" style={{ width: `${Math.min(100, (pool / Math.max(1, threshold)) * 100)}%` }} /></div>
                    </>
                  ) : <p className="text-[11px] text-white/80 mt-0.5">추첨 후 판도라 박스가 열리면 공개돼요</p>}
                </>
              )}
            </div>
          </div>
        )}

        {/* 당첨자 */}
        {drawn && winners.length > 0 && (
          <div className="shrink-0 mt-2 w-full max-w-[360px] flex flex-wrap justify-center gap-1.5">
            {winners.slice(0, 6).map((w) => (
              <span key={w.rank} className="inline-flex items-center gap-1 rounded-full bg-[#ffd166]/20 border border-[#ffd166]/50 text-[#ffe9a8] text-[11.5px] font-bold px-2.5 py-1">🏆 {w.name}</span>
            ))}
            {winners.length > 6 && <span className="text-[11.5px] text-white/70 self-center">외 {winners.length - 6}명</span>}
          </div>
        )}
      </div>

      {/* 하단 — 참여 버튼 */}
      <div className={`relative z-10 shrink-0 px-5 pt-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent ${layout === 'feed-mobile' ? (isApp ? 'pb-28' : 'pb-24') : 'pb-6'}`}>
        {msg && <p className="mb-2 text-[12.5px] text-[#ffd166] font-semibold text-center">{msg}</p>}
        <div className="flex items-center gap-3">
          <button onClick={insertCoin} disabled={closed || coinState === 'drop'} className={`flex-1 h-[52px] ${titleFont.className} text-[20px] rounded-full flex items-center justify-center gap-2 transition-all ${closed ? 'bg-white/15 text-white/60' : coinState === 'done' ? 'bg-gradient-to-b from-[#6dff8a] to-[#22c55e] text-[#053b16] shadow-[0_5px_0_#15803d,0_9px_16px_rgba(0,0,0,0.35)]' : 'bg-gradient-to-b from-[#ffd94f] to-[#ffb62e] text-[#3a2c00] shadow-[0_5px_0_#d18f00,0_9px_16px_rgba(0,0,0,0.35)] active:translate-y-1 active:shadow-[0_1px_0_#d18f00] disabled:opacity-90'}`}>
            {drawn ? '당첨 발표 완료' : closed ? '마감 — 곧 추첨해요' : coinState === 'drop' ? (
              <>
                <svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin" fill="none" aria-hidden><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                코인 투입 중...
              </>
            ) : coinState === 'done' ? '✓ 참여 완료! 한 번 더?' : `🎰 ${jackpot.entry_cost} 코인으로 도전`}
          </button>
          {/* 미니 코인 슬롯 — 게임 쇼츠와 같은 모양 */}
          {!closed && (
            <div className="relative w-12 h-[58px] shrink-0">
              <div className={`w-full h-full rounded-lg bg-gradient-to-b from-[#4a4a4a] to-[#2a2a2a] border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_4px_10px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center gap-1.5 transition-shadow ${coinState === 'done' ? 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_0_16px_rgba(76,255,106,0.5)]' : ''} ${coinState === 'drop' ? 'slot-clink' : ''}`}>
                <span className="w-1.5 h-7 rounded-full bg-black shadow-[inset_0_0_4px_rgba(0,0,0,0.9)]" />
                <span className={`w-2.5 h-2.5 rounded-full ${coinState === 'done' ? 'bg-[#4cff6a] shadow-[0_0_8px_#4cff6a]' : 'bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse'}`} />
              </div>
              {coinState === 'drop' && (
                <>
                  <span className="gold-coin absolute left-1/2 -top-6" style={{ '--coin-drop': '31px' } as React.CSSProperties} aria-hidden />
                  <span className="slot-spark absolute left-1/2 top-[8px] -translate-x-1/2 text-xs" aria-hidden>✨</span>
                </>
              )}
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-[10.5px] text-white/55">참여 토큰동전은 환불되지 않아요 · 마감 후 낸 토큰동전만큼 확률로 {winnerCount}명 추첨</p>
      </div>
    </div>
  )

  if (layout === 'feed-desktop') {
    return (
      <div className="h-full snap-start [scroll-snap-stop:always] flex items-center justify-center gap-5">
        <div className="relative h-[96%] aspect-[9/15] rounded-2xl overflow-hidden shadow-[0_18px_60px_rgba(36,31,23,0.22)]">{inner}</div>
        <CardRail name="VIBREXCUP" color="#FFD166" shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/games` : undefined} stats={[
          { icon: <span className="text-[18px] text-[#ffd166]">✦</span>, label: pool.toLocaleString() },
          { icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M2.8 19c.6-3.3 3-5 6.2-5s5.6 1.7 6.2 5" /><circle cx="17" cy="9" r="2.6" /><path d="M15.5 14.2c3 .2 5 1.8 5.6 4.8" /></svg>, label: `${entries}명` },
        ]} />
      </div>
    )
  }
  if (layout === 'preview') return inner   // 관리자 미리보기 — 부모(relative, 9:15)가 크기를 잡는다
  return <div className="feed-snap relative h-[100svh] overflow-hidden bg-[#0a0619]">{inner}</div>
}
