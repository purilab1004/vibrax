'use client'
// 피드(쇼츠) 맨 끝 카드 — 더 내려갈 게임이 없을 때 "이제 당신 차례" 로 게임 제작을 권한다.
// 모바일은 한 화면 스냅 카드, 데스크톱은 피드 카드와 같은 틀.
import Link from 'next/link'
import CardRail from '@/components/CardRail'

const ORBS = [
  { e: '🎮', x: '8%', y: '14%', d: '0s', s: 44 }, { e: '🧱', x: '78%', y: '10%', d: '1.2s', s: 34 }, { e: '💫', x: '86%', y: '38%', d: '0.4s', s: 28 },
  { e: '🚀', x: '12%', y: '60%', d: '2s', s: 36 }, { e: '👾', x: '70%', y: '72%', d: '0.8s', s: 40 }, { e: '🏆', x: '30%', y: '82%', d: '1.6s', s: 30 },
]

export default function FeedEndCard({ layout }: { layout: 'mobile' | 'desktop' }) {
  const toTop = () => {
    try {
      const el = document.querySelector('.md-page-feed, .snap-y') as HTMLElement | null
      if (layout === 'desktop' && el) el.scrollTo({ top: 0, behavior: 'smooth' })
      else window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { /* noop */ }
  }
  const inner = (
    <div className="relative w-full h-full overflow-hidden flex flex-col items-center justify-center text-center px-7" style={{ background: 'radial-gradient(120% 90% at 50% 0%, #2b1b6b 0%, #120b33 45%, #06040f 100%)' }}>
      <style>{`
        @keyframes vbxFloat { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-16px) rotate(5deg); } }
        @keyframes vbxGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,122,42,.55), 0 14px 40px rgba(255,90,0,.35); } 50% { box-shadow: 0 0 0 14px rgba(255,122,42,0), 0 18px 50px rgba(255,90,0,.5); } }
        @keyframes vbxShine { 0% { transform: translateX(-140%) skewX(-20deg); } 60%,100% { transform: translateX(240%) skewX(-20deg); } }
        @keyframes vbxBeam { 0%,100% { opacity: .35; } 50% { opacity: .7; } }
        .vbx-end-orb { position:absolute; animation: vbxFloat 4.5s ease-in-out infinite; filter: drop-shadow(0 6px 14px rgba(0,0,0,.45)); pointer-events:none; }
        .vbx-end-btn { animation: vbxGlow 2.4s ease-in-out infinite; }
        .vbx-end-btn::after { content:''; position:absolute; top:0; bottom:0; width:38%; background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.55) 50%, rgba(255,255,255,0) 100%); animation: vbxShine 2.8s ease-in-out infinite; }
        .vbx-end-beam { position:absolute; inset:-20% -10% auto; height:70%; background: conic-gradient(from 180deg at 50% 0%, transparent 35%, rgba(124,92,255,.35) 50%, transparent 65%); animation: vbxBeam 3.5s ease-in-out infinite; pointer-events:none; }
        @media (prefers-reduced-motion: reduce) { .vbx-end-orb, .vbx-end-btn, .vbx-end-btn::after, .vbx-end-beam { animation: none; } }
      `}</style>
      <div className="vbx-end-beam" />
      {ORBS.map((o) => (
        <span key={o.e + o.x} className="vbx-end-orb" style={{ left: o.x, top: o.y, fontSize: o.s, animationDelay: o.d }}>{o.e}</span>
      ))}
      {/* 별 가루 */}
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.55) 1px, transparent 1.5px), radial-gradient(rgba(255,255,255,.35) 1px, transparent 1.5px)', backgroundSize: '90px 90px, 140px 140px', backgroundPosition: '0 0, 40px 60px' }} />

      <div className="relative z-10 flex flex-col items-center" style={{ wordBreak: 'keep-all' }}>
        <p className="text-[11px] tracking-[0.32em] text-[#c9b8ff] font-bold mb-4" style={{ fontFamily: 'var(--font-press-start), monospace' }}>THE END?</p>
        <h2 className="text-white font-extrabold leading-[1.15] text-[30px] md:text-[34px] drop-shadow-[0_4px_18px_rgba(124,92,255,.55)]">
          여기까지 다 봤어요.<br />
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg,#ffd166,#ff7a2a,#ff4fa3)' }}>다음 게임은 당신 차례!</span>
        </h2>
        <p className="mt-4 text-[15px] md:text-[16px] text-[#e6e0ff]/85 leading-relaxed max-w-[300px]">
          말 한 줄이면 AI 가 게임을 만들어요.<br />직접 <b className="text-white">게임을 제작해서 공유</b>하고, 다른 사람이 플레이하는 걸 지켜보세요.
        </p>
        <Link
          href="/studio"
          className="vbx-end-btn relative overflow-hidden mt-8 inline-flex items-center justify-center gap-2.5 h-[60px] px-9 rounded-full text-white text-[19px] font-extrabold tracking-tight active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(180deg,#ff9a4a 0%,#ff5f1f 100%)', border: '2px solid rgba(255,255,255,.35)' }}
        >
          <span className="text-[22px]">🎮</span> 게임 만들기
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </Link>
        <p className="mt-3 text-[12px] text-[#c9b8ff]/80">무료로 시작 · 코딩 필요 없음 · 1분이면 완성</p>
        <button onClick={toTop} className="mt-8 text-[13px] text-white/60 hover:text-white underline underline-offset-4">처음부터 다시 보기 ↑</button>
      </div>
    </div>
  )

  if (layout === 'desktop') {
    return (
      <div className="h-full snap-start [scroll-snap-stop:always] flex items-center justify-center gap-5">
        <div className="relative h-[96%] aspect-[9/15] rounded-2xl overflow-hidden shadow-[0_18px_60px_rgba(36,31,23,0.22)]">{inner}</div>
        <CardRail name="VIBREXCUP" color="#F27EA9" shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/studio` : undefined} stats={[{ icon: <span className="text-[18px]">🎮</span>, label: '만들기' }]} />
      </div>
    )
  }
  return (
    <div className="feed-snap relative h-[100svh] overflow-hidden" style={{ paddingTop: 'var(--st, 0px)', paddingBottom: 'var(--sb, 0px)', background: '#06040f' }}>
      {inner}
    </div>
  )
}
