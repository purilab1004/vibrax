'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/context'
import LogoMark from '@/components/LogoMark'

// 사이트 푸터 — 브랜드 / 메뉴 / 정책·연락처 3단 구성
export default function FooterLinks() {
  const { T } = useLang()
  const f = T.footer

  const col = 'flex flex-col gap-2.5'
  const head = 'font-pixel text-[10px] tracking-[0.2em] text-[#9d9280] mb-1'
  const item = 'text-[13px] text-[#6b6152] hover:text-[#2563eb] transition-colors w-fit'

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-10 py-4">
        {/* 브랜드 */}
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2 w-fit hover:opacity-80 transition-opacity">
            <LogoMark className="w-8 h-8 shrink-0" />
            <span className="text-lg font-extrabold tracking-tight text-[#241f17]">
              vibrex<span className="text-[#2563eb]">cup</span>
            </span>
          </Link>
          <p className="text-[13px] text-[#857a68] leading-relaxed max-w-xs">
            프롬프트 한 줄로 게임을 만들고, AI 스트리머와 함께 전 세계와 공유하세요.
          </p>
        </div>

        {/* 메뉴 */}
        <nav className={col} aria-label="footer menu">
          <span className={head}>MENU</span>
          <Link href="/games" className={item}>GAMES</Link>
          <Link href="/studio" className={item}>STUDIO</Link>
          <Link href="/tournament" className={item}>TOURNAMENT</Link>
          <Link href="/blog" className={item}>BLOG</Link>
        </nav>

        {/* 정책 · 연락처 */}
        <nav className={col} aria-label="footer legal">
          <span className={head}>SUPPORT</span>
          <Link href="/terms" className={item}>{f.terms}</Link>
          <Link href="/privacy" className={item}>{f.privacy}</Link>
          <Link href="/refund" className={item}>{f.refund}</Link>
          <a href="mailto:dev@puritechlab.com" className={item}>dev@puritechlab.com</a>
        </nav>
      </div>

      {/* 하단 바 — 카피라이트 + 운영사 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-[#ebe4d6] mt-2 pt-5">
        <p className="font-pixel text-[11px] text-[#9d9280] tracking-widest">{f.copyright}</p>
        <a
          href="https://puritechlab.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-[#857a68] hover:text-[#2563eb] transition-colors"
        >
          Operated by <span className="font-semibold">PuriTechLab</span> ↗
        </a>
      </div>
    </div>
  )
}
