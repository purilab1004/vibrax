'use client'
// 관리자 모바일 메뉴 — 가로 칩 25개 대신 '☰ 현재 페이지' 버튼 하나 + 그룹별 시트 (데스크톱은 AdminRail)
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'

export default function AdminNav() {
  const pathname = usePathname()
  const { T } = useLang()
  const a = T.admin
  const [open, setOpen] = useState(false)
  const groups: { title: string; items: [string, string, string][] }[] = [
    { title: '운영', items: [['/admin', a.navDashboard, '📊'], ['/admin-ops', 'AI 대시보드', '🤖'], ['/admin/map', '지도보드', '🗺️'], ['/admin/access', '접속 관리', '📈'], ['/admin/logs', '에러 로그', '⚠️'], ['/admin/security', '보안·서버', '🛡️']] },
    { title: '콘텐츠', items: [['/admin/games', a.navGames, '🎮'], ['/admin/templates', '템플릿', '🧩'], ['/admin/media', '미디어 라이브러리', '🖼️'], ['/admin/blog', a.navBlog, '📝'], ['/admin/notices', a.navNotices, '📢'], ['/admin/legal', '약관 관리', '📄']] },
    { title: '회원·커뮤니티', items: [['/admin/members', a.navMembers, '👥'], ['/admin/applications', a.navApplications, '📨'], ['/admin/designers', '디자이너', '🎨'], ['/admin/broadcasts', '방송 관리', '📡'], ['/admin/aj', 'AJ 랭킹', '🏆'], ['/admin/jackpots', '토큰동전 잭팟', '🎰']] },
    { title: '수익·AI·설정', items: [['/admin/payments', '결제 관리', '💳'], ['/admin/ads', 'AdPilot', '📣'], ['/admin/costs', 'TokenPilot', '🪙'], ['/admin/llmpilot', 'LLMPilot', '🧠'], ['/admin/mlpilot', 'MLPilot', '🔬'], ['/admin/controls', '컨트롤러', '🕹️'], ['/admin/settings', a.navSettings, '⚙️']] },
  ]
  const active = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href))
  const current = groups.flatMap((g) => g.items).filter(([h]) => active(h)).sort((x, y) => y[0].length - x[0].length)[0]
  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full h-12 rounded-xl bg-white border border-[#e3e6ec] shadow-sm px-3.5 flex items-center gap-2.5 text-left">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#2563eb] shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        <span className="text-[15px] font-bold text-[#1f2430] truncate">{current ? `${current[2]} ${current[1]}` : '관리자 메뉴'}</span>
        <span className="ml-auto text-[12px] font-semibold text-[#6b7280] shrink-0">메뉴</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-end" onClick={() => setOpen(false)}>
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#f4f5f8] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-10 h-1.5 rounded-full bg-[#d1d5db] mb-3" />
            <div className="flex items-center justify-between mb-3">
              <p className="text-[17px] font-extrabold text-[#1f2430]">관리자 메뉴</p>
              <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-full bg-white border border-[#e3e6ec] text-[#6b7280]" aria-label="닫기">✕</button>
            </div>
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.title}>
                  <p className="text-[12px] font-bold text-[#6b7280] mb-1.5 px-1">{g.title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {g.items.map(([href, label, icon]) => (
                      <Link key={href} href={href} onClick={() => setOpen(false)} className={`h-12 rounded-xl px-3 flex items-center gap-2 text-[14px] font-semibold border ${active(href) && current?.[0] === href ? 'bg-[#2563eb] border-[#2563eb] text-white' : 'bg-white border-[#e3e6ec] text-[#1f2430]'}`}>
                        <span aria-hidden>{icon}</span><span className="truncate">{label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
