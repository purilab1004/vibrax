'use client'
// 페이지 제목 줄 — 헤더 바로 밑, 모든 일반 페이지(홈·스튜디오·게임 제외)에 같은 모양으로.
// 큰 영문 제목 + 한 줄 설명. 페이지마다 탭·검색은 이 아래 각 페이지가 그린다.
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'

const PAGES: { prefix: string; title: string; ko: string; en: string; dark?: boolean }[] = [
  { prefix: '/gallery', title: 'GALLERY', ko: '디자이너들이 올린 캐릭터·배경·아이템·효과음 — 골라서 바로 게임에 넣어 보세요.', en: 'Characters, backgrounds, items and sounds from designers — drop them into your game.' },
  { prefix: '/story', title: 'STORY', ko: '게임마다 연재되는 웹툰과 웹소설. 다 읽으면 바로 그 게임을 플레이하세요.', en: 'Webtoons and web novels serialized for every game — then play the game itself.' },
  { prefix: '/partner', title: 'PARTNER', ko: '바이브렉스컵과 함께 게임을 알리고 키워 갈 파트너를 찾습니다.', en: 'Grow and promote games together with Vibrexcup.' },
  { prefix: '/dev', title: 'DEV', ko: 'Vibrex 빌더 앱·API·크롬 확장 — 내 도구에서 게임을 만들고 올리세요.', en: 'Vibrex builder app, API and extensions — build games from your own tools.' },
  { prefix: '/about', title: 'ABOUT', ko: '프롬프트 한 줄로 게임을 만들고 함께 노는 곳, 바이브렉스컵 이야기.', en: 'The story of Vibrexcup — make games from a single prompt and play together.' },
  { prefix: '/tournament', title: 'EVENT', ko: '바이브렉스컵 대회와 이벤트 — 참가하고 상금을 받아 가세요.', en: 'Vibrexcup tournaments and events — join and win.' },
]

export default function PageTitleBar() {
  const pathname = usePathname() ?? ''
  const { lang } = useLang()
  // STORY·GALLERY 는 페이지가 같은 모양의 줄(제목 + 탭 + 검색)을 직접 그린다
  if (pathname === '/story' || pathname === '/gallery') return null
  const p = PAGES.find((x) => pathname === x.prefix)
  if (!p) return null
  return (
    <div className="bg-white border-b border-[#e8eaef] md:pl-[var(--rail-w,0rem)]">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 h-12 md:h-14 flex items-center gap-4 md:gap-6 min-w-0">
        <span className="hidden md:inline text-[22px] font-black tracking-[-0.04em] shrink-0 text-[#1a1d24]">{p.title}</span>
        <span className="text-[13px] md:text-[14px] text-[#6b7280] truncate">{lang === 'en' ? p.en : p.ko}</span>
      </div>
    </div>
  )
}
