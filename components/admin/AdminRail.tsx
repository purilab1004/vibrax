'use client'
// 관리자 좌측 다크 아이콘 레일 — 트렌디 SaaS 관리자 톤 (아이콘 + 호버 라벨), 데스크톱 전용
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useLang } from '@/lib/i18n/context'
import LogoMark from '@/components/LogoMark'
import { AutoDot, useAutoHealth } from '@/components/admin/AutoStatusDot'

const ICON = 'w-[18px] h-[18px]'
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export default function AdminRail() {
  const pathname = usePathname()
  const { T } = useLang()
  const auto = useAutoHealth()
  const a = T.admin
  useEffect(() => { document.documentElement.style.setProperty('--rail-w', '3.5rem'); return () => { document.documentElement.style.setProperty('--rail-w', '0rem') } }, [])
  // [href, label, icon, accent?] — 엔진(AdPilot·TokenPilot)은 고유 색으로 구분
  const groups: { title: string; items: [string, string, React.ReactNode, string?][] }[] = [
    { title: '개요', items: [
      ['/admin-ops', 'AI 대시보드', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>],
      ['/admin/map', '지도보드', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" /></svg>],
      ['/admin', a.navDashboard, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="4" y="4" width="7" height="9" rx="1" /><rect x="13" y="4" width="7" height="5" rx="1" /><rect x="13" y="11" width="7" height="9" rx="1" /><rect x="4" y="15" width="7" height="5" rx="1" /></svg>],
    ] },
    { title: '콘텐츠', items: [
      ['/admin/games', a.navGames, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="3" y="7" width="18" height="11" rx="3" /><path d="M8 11v4M6 13h4M15 12h.01M17.5 14h.01" /></svg>],
      ['/admin/blog', a.navBlog, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M5 4h11l3 3v13H5Z" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>],
      ['/admin/notices', a.navNotices, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M4 10v4l10 4V6L4 10Z" /><path d="M14 8.5a3.5 3.5 0 0 1 0 7M6.5 14.5V19" /></svg>],
      ['/admin/templates', '템플릿', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M17.5 14v7M14 17.5h7" /></svg>],
    ] },
    { title: '사람·활동', items: [
      ['/admin/members', a.navMembers, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c1-3 3.2-4.5 5.5-4.5s4.5 1.5 5.5 4.5" /><circle cx="17" cy="9.5" r="2.3" /><path d="M16 14.7c2.5.2 4 1.6 4.5 4.3" /></svg>],
      ['/admin/broadcasts', '방송 관리', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="3" y="7" width="13" height="10" rx="2" /><path d="m16 10 5-2v8l-5-2" /></svg>],
      ['/admin/applications', a.navApplications, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M8 4h8l2 2v14H6V6l2-2Z" /><path d="M9 4v3h6V4M9 12l2 2 4-4" /></svg>],
      ['/admin/aj', 'AJ 랭킹', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M4 19h16M6 19v-6M12 19V5M18 19v-9" /></svg>],
    ] },
    { title: '비즈니스', items: [
      ['/admin/payments', '결제 관리', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></svg>],
      ['/admin/ads', 'AdPilot', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M4 11v2a1 1 0 0 0 1 1h3l6 4V6L8 10H5a1 1 0 0 0-1 1Z" /><path d="M17 9a4 4 0 0 1 0 6" /></svg>, '#a855f7'],
    ] },
    { title: '엔진', items: [
      ['/admin/costs', 'TokenPilot', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" /></svg>, '#22d3ee'],
      ['/admin/llmpilot', 'LLMPilot', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="11" cy="11" r="6" /><path d="m20 20-4-4M8.5 11h5M11 8.5v5" /></svg>, '#10b981'],
      ['/admin/mlpilot', 'MLPilot', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><circle cx="12" cy="12" r="2.5" /><path d="M8 7.5l2.5 2.5M16 7.5l-2.5 2.5M8 16.5l2.5-2.5M16 16.5l-2.5-2.5" /></svg>, '#c084fc'],
    ] },
    { title: '시스템', items: [
      ['/admin/legal', '약관 관리', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M6 3h9l4 4v14H6Z" /><path d="M15 3v4h4M9 12h6M9 16h6M9 8h2" /></svg>],
      ['/admin/access', '접속 관리', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M4 18V10M10 18V6M16 18v-4M22 18H2" /></svg>],
      ['/admin/logs', '에러 로그', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M12 9v4M12 17h.01M10.3 4.3 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /></svg>],
      ['/admin/security', '보안·서버', <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>],
      ['/admin/settings', a.navSettings, <svg key="i" viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></svg>],
    ] },
  ]
  const active = (href: string) => href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  return (
    <aside className="group/rail hidden md:flex fixed top-0 left-0 bottom-0 z-[60] w-14 hover:w-56 transition-[width] duration-200 flex-col bg-[#171b26] text-[#9aa3b5] border-r border-black/20 shadow-[8px_0_24px_-12px_rgba(0,0,0,0)] hover:shadow-[8px_0_24px_-12px_rgba(0,0,0,0.5)] overflow-hidden" aria-label="admin rail">
      <Link href="/admin" className="h-14 w-full flex items-center gap-3 px-3.5 hover:opacity-90" title="vibrexadmin"><LogoMark className="w-7 h-7 shrink-0" /><span className="text-white text-[15px] font-extrabold tracking-tight whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity">vibrex<span className="text-[#60a5fa]">admin</span></span></Link>
      <nav className="flex-1 w-full flex flex-col py-1 px-2 overflow-y-auto scrollbar-hide">
        {groups.map((grp, gi) => (
          <div key={grp.title} className={gi > 0 ? 'mt-1 pt-1 border-t border-white/10' : ''}>
            {/* 대메뉴 — 펼쳤을 때 라벨, 접혔을 때는 구분선만 */}
            <p className="h-5 px-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity flex items-center">{grp.title}</p>
            {grp.items.map(([href, label, icon, accent]) => {
              const on = active(href)
              const isEngine = !!accent
              return (
                <Link key={href} href={href} style={isEngine ? (on ? { background: accent, color: '#fff' } : { color: accent }) : undefined} className={`relative h-9 w-full rounded-md flex items-center gap-3 px-[11px] transition-colors ${on ? (isEngine ? '' : 'bg-[#2563eb] text-white') : 'hover:bg-white/10 hover:text-white'}`} aria-label={label}>
                  <span className="relative shrink-0">{icon}{auto?.menuModule[href] && <span className="absolute -top-1 -right-1.5 group-hover/rail:hidden"><AutoDot state={auto.health[auto.menuModule[href]]?.state ?? 'off'} size={7} /></span>}</span>
                  <span className="text-[12.5px] font-semibold whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity flex items-center gap-2">{label}{auto?.menuModule[href] && <AutoDot state={auto.health[auto.menuModule[href]]?.state ?? 'off'} />}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="w-full flex flex-col gap-0.5 pb-3 px-2">
        <Link href="/" className="h-10 w-full rounded-md flex items-center gap-3 px-[11px] hover:bg-white/10 hover:text-white" aria-label="사이트로">
          <span className="shrink-0"><svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10" /></svg></span>
          <span className="text-[12.5px] font-semibold whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity">사이트로 돌아가기</span>
        </Link>
      </div>
    </aside>
  )
}
