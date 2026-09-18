'use client'
// 등록 허브 — 방송 / 게임 추가 / 웹툰 추가 세 갈래.
//   /submit            → 무엇을 올릴지 고르는 화면
//   /submit?kind=game  → 게임 등록 폼(외부 링크·파일)
//   /submit?kind=webtoon → 웹툰 쇼츠 등록 폼
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GameSubmitForm from '@/components/GameSubmitForm'
import WebtoonSubmitForm from '@/components/WebtoonSubmitForm'
import type { User } from '@supabase/supabase-js'
import { useLang } from '@/lib/i18n/context'

type Kind = 'game' | 'webtoon'

function Chooser() {
  const cards: { href: string; emoji: string; title: string; desc: string; accent: string }[] = [
    { href: '/broadcast', emoji: '🔴', title: '방송', desc: '폰 카메라·게임 화면을 그대로 생중계하거나, 유튜브·트위치 링크를 걸어요.', accent: '#e11d48' },
    { href: '/submit?kind=game', emoji: '🎮', title: '게임 추가', desc: '이미 만든 게임을 링크나 파일로 올려 쇼츠 피드에 세워요.', accent: '#2563eb' },
    { href: '/submit?kind=webtoon', emoji: '📖', title: '웹툰 추가', desc: '컷 이미지를 올리면 탭으로 넘겨 보는 웹툰 쇼츠가 돼요. 게임과 연결할 수 있어요.', accent: '#ff2d6f' },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map(c => (
        <Link key={c.href} href={c.href}
          className="group rounded-3xl border-2 border-[#e5dcc8] hover:border-[color:var(--ac)] bg-white p-6 transition-colors"
          style={{ ['--ac' as string]: c.accent }}>
          <span className="text-[30px] leading-none">{c.emoji}</span>
          <p className="mt-3 text-[18px] font-extrabold tracking-[-0.01em] text-[#241f17] group-hover:text-[color:var(--ac)] transition-colors">{c.title}</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#6b6152]" style={{ wordBreak: 'keep-all' }}>{c.desc}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-bold text-[color:var(--ac)]">시작하기 →</span>
        </Link>
      ))}
    </div>
  )
}

function SubmitInner() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useSearchParams()
  const kind = (params.get('kind') as Kind | null) ?? null
  const supabase = createClient()
  const { T } = useLang()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push(`/login?redirect=/submit${kind ? `?kind=${kind}` : ''}`)
      else { setUser(user); setLoading(false) }
    })
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="font-pixel text-[11px] text-[#6b6152] tracking-widest">{T.submit.loading}</p>
  if (!user) return null

  if (kind === 'game') return (
    <>
      <Head title={T.submit.heading} desc={T.submit.subtitle} />
      <GameSubmitForm userId={user.id} />
    </>
  )
  if (kind === 'webtoon') return (
    <>
      <Head title="웹툰 추가" desc="컷 이미지를 순서대로 올리면 탭으로 넘겨 보는 웹툰 쇼츠가 됩니다. 게임을 연결하면 다 본 뒤 바로 플레이로 이어져요." />
      <WebtoonSubmitForm userId={user.id} />
    </>
  )
  return (
    <>
      <Head title="무엇을 올릴까요?" desc="방송 · 게임 · 웹툰 — 모두 같은 쇼츠 피드에 올라갑니다." />
      <Chooser />
    </>
  )
}

function Head({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-8">
      <Link href="/submit" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-[#9d9280] hover:text-[#241f17] transition-colors mb-3">← 등록 메뉴</Link>
      <h1 className="text-[26px] md:text-[32px] font-black tracking-[-0.02em] text-[#241f17]">{title}</h1>
      <p className="mt-2 text-[14px] text-[#6b6152] max-w-2xl leading-relaxed" style={{ wordBreak: 'keep-all' }}>{desc}</p>
    </div>
  )
}

export default function SubmitPage() {
  return (
    <div className="max-w-5xl mx-auto px-5 md:px-6 py-8 md:py-12">
      <Suspense fallback={null}><SubmitInner /></Suspense>
    </div>
  )
}
