'use client'
// 인증 화면 공통 셸 — 좌측 브랜드 패널(그라디언트·문구) + 우측 카드. 로그인/가입/비밀번호 찾기/재설정에서 공용.
import Link from 'next/link'
import LogoMark from '@/components/LogoMark'

export const authInput = 'w-full h-11 rounded-xl border border-[#ddd3bf] bg-white px-4 text-[14px] text-[#241f17] placeholder-[#a1957f] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10 transition'
export const authLabel = 'block text-[12px] font-semibold text-[#6b6152] mb-1.5'
export const authPrimary = 'w-full h-12 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white text-[15px] font-bold shadow-[0_10px_26px_-8px_rgba(37,99,235,0.6)] hover:shadow-[0_14px_32px_-8px_rgba(37,99,235,0.7)] hover:brightness-105 disabled:opacity-50 transition-all'

export function GoogleIcon({ className = 'w-4.5 h-4.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.4 35.4 44 30.1 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  )
}

export default function AuthShell({ eyebrow, title, subtitle, children, footer }: { eyebrow: string; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100svh-3.5rem)] grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr]">
      {/* 좌측 — 브랜드 */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#0b1020] text-white p-9">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.55),transparent)] blur-2xl" />
          <div className="absolute bottom-[-160px] right-[-120px] w-[560px] h-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(6,182,212,0.45),transparent)] blur-2xl" />
          <div className="absolute top-1/3 right-10 w-[300px] h-[300px] rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.35),transparent)] blur-2xl" />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        </div>
        <Link href="/" className="relative flex items-center gap-2.5 w-fit">
          <LogoMark className="w-9 h-9" />
          <span className="text-[20px] font-extrabold tracking-tight">vibrex<span className="text-[#60a5fa]">cup</span></span>
        </Link>
        <div className="relative max-w-md">
          <p className="font-pixel text-[10px] tracking-[0.35em] text-[#60a5fa]">PROMPT → GAME → WORLD</p>
          <h2 className="mt-3 text-[30px] leading-[1.12] font-extrabold tracking-tight">프롬프트 한 줄로<br />게임을 만들고,<br /><span className="bg-gradient-to-r from-[#60a5fa] via-[#22d3ee] to-[#fbbf24] bg-clip-text text-transparent">AJ와 함께 세계로.</span></h2>
          <p className="mt-4 text-[13px] text-white/60 leading-relaxed">AI 스튜디오에서 만들고, 나만의 점토 아바타로 방송하고, AI 게임 기업가 AJ가 성장과 수익을 챙겨줍니다.</p>
          <div className="mt-6 flex items-center gap-4 text-[11.5px] text-white/50 flex-wrap">
            <span><b className="text-white text-[16px] mr-1">30</b>가입 프롬코인</span>
            <span className="w-px h-4 bg-white/15" />
            <span><b className="text-white text-[16px] mr-1">1,000</b>게임 코인</span>
            <span className="w-px h-4 bg-white/15" />
            <span>무료 시작</span>
          </div>
        </div>
        <p className="relative text-[11px] text-white/35">VIBREX © COPYRIGHT {new Date().getFullYear()} · Sponsored by Purilab</p>
      </aside>
      {/* 우측 — 카드 */}
      <main className="relative flex items-center justify-center px-5 py-10 bg-[#f4efe6] overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-32 right-[-120px] w-[420px] h-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.18),transparent)] blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute bottom-[-140px] left-[-100px] w-[380px] h-[380px] rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.18),transparent)] blur-2xl" />
        <div className="relative w-full max-w-[440px] rounded-3xl bg-white border border-white/70 shadow-[0_30px_80px_-30px_rgba(36,31,23,0.35),0_2px_6px_rgba(36,31,23,0.06)] p-7 md:p-9">
          <div className="lg:hidden flex items-center gap-2 mb-6"><LogoMark className="w-8 h-8" /><span className="text-[18px] font-extrabold tracking-tight text-[#241f17]">vibrex<span className="text-[#2563eb]">cup</span></span></div>
          <p className="font-pixel text-[10px] tracking-[0.3em] text-[#2563eb]">{eyebrow}</p>
          <h1 className="mt-2 text-[30px] font-extrabold tracking-tight text-[#241f17] leading-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-[13.5px] text-[#6b6152]">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-7 pt-5 border-t border-[#f0eadf] text-[13px] text-[#6b6152]">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
