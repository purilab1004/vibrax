import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { getStoryData, isUp, fmtDate, GENRE_KO } from '@/lib/story/data'
import type { WebtoonCut } from '@/lib/supabase/types'

// STORY 작품(시리즈) 페이지 — 표지·작가·소개, 1화부터 보기 / 지금 플레이, 회차 목록, 연결된 웹툰 컷
export const revalidate = 120

const fetchWebtoons = unstable_cache(
  async (gameId: string) => {
    const sb = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data } = await sb.from('webtoons').select('id, title, cuts').eq('game_id', gameId).eq('published', true).order('created_at', { ascending: false }).limit(4)
    return (data ?? []) as { id: string; title: string; cuts: WebtoonCut[] }[]
  },
  ['story-webtoons'], { revalidate: 300 },
)

async function getSeries(gameId: string) {
  return (await getStoryData()).find(s => s.game.id === gameId) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ gameId: string }> }): Promise<Metadata> {
  const { gameId } = await params
  const s = await getSeries(gameId)
  if (!s) return { title: 'STORY' }
  const description = `${s.game.title} — ${s.episodes.length}화 연재 중. ${s.episodes[0]?.excerpt ?? s.game.teaser ?? ''}`.slice(0, 160)
  return {
    title: `${s.game.title} | STORY`,
    description,
    alternates: { canonical: `https://vibrexcup.com/story/series/${gameId}` },
    openGraph: { title: `${s.game.title} | STORY`, description, url: `https://vibrexcup.com/story/series/${gameId}`, ...(s.cover ? { images: [{ url: s.cover }] } : {}) },
  }
}

export default async function SeriesPage({ params, searchParams }: { params: Promise<{ gameId: string }>; searchParams: Promise<{ order?: string }> }) {
  const { gameId } = await params
  const { order } = await searchParams
  const s = await getSeries(gameId)
  if (!s) notFound()
  const webtoons = await fetchWebtoons(gameId)
  const first = s.episodes[0]
  const latest = s.episodes[s.episodes.length - 1]
  const eps = order === 'new' ? [...s.episodes].reverse() : s.episodes

  return (
    <div className="min-h-screen bg-white text-[#1a1d24]">
      {/* ── 작품 머리 — 흐린 표지 배경 위에 표지 + 정보 ── */}
      <header className="relative overflow-hidden bg-[#1a1d24]">
        {s.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.cover} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-45" />
        )}
        <div className="relative max-w-4xl mx-auto px-4 md:px-6 pt-4 pb-6 md:py-10">
          <Link href="/story" className="inline-flex items-center gap-1 text-[13px] font-semibold text-white/75 hover:text-white">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>STORY
          </Link>
          <div className="mt-4 flex gap-4 md:gap-7 items-end">
            <div className="relative w-[112px] md:w-[184px] shrink-0 aspect-[9/16] rounded-[8px] overflow-hidden bg-white/10 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]">
              {s.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.cover} alt={s.game.title} className="absolute inset-0 w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0 text-white pb-1">
              <div className="flex flex-wrap gap-1.5">
                {isUp(s.latestAt) && <span className="px-1.5 h-5 inline-flex items-center rounded-[3px] bg-[#ff3b47] text-[11px] font-extrabold">UP</span>}
                <span className="px-1.5 h-5 inline-flex items-center rounded-[3px] bg-white/20 text-[11px] font-bold">{GENRE_KO[s.game.genre] ?? s.game.genre}</span>
                <span className="px-1.5 h-5 inline-flex items-center rounded-[3px] bg-white/20 text-[11px] font-bold">연재 중</span>
              </div>
              <h1 className="mt-2 text-[22px] md:text-[34px] font-black leading-[1.15] tracking-[-0.03em]">{s.game.title}</h1>
              <p className="mt-1 text-[13.5px] md:text-[15px] text-white/80">{s.author}</p>
              <p className="mt-1 text-[12.5px] md:text-[13.5px] text-white/60 tabular-nums">총 {s.episodes.length}화 · 조회 {s.views.toLocaleString()}</p>
            </div>
          </div>
          {(s.game.intro || s.game.teaser) && <p className="mt-4 md:mt-6 text-[13.5px] md:text-[15px] leading-relaxed text-white/85 max-w-2xl">{s.game.intro || s.game.teaser}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2 md:flex md:gap-3">
            {first && <Link href={`/story/${first.id}`} className="h-12 md:px-8 inline-flex items-center justify-center rounded-[8px] bg-white text-[#1a1d24] text-[15px] font-extrabold hover:bg-white/90">1화부터 보기</Link>}
            <Link href={`/games/${s.game.id}`} className="h-12 md:px-8 inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-[#1f6fff] text-white text-[15px] font-extrabold hover:bg-[#1a5fe0]">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7-11-7Z" /></svg>지금 플레이하기
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 pb-20">
        {/* ── 회차 목록 ── */}
        <section className="mt-6 md:mt-8">
          <div className="flex items-center justify-between border-b border-[#1a1d24] pb-3">
            <h2 className="text-[17px] md:text-[19px] font-extrabold">회차 <span className="text-[#9097a3] font-bold tabular-nums">{s.episodes.length}</span></h2>
            <div className="flex gap-3 text-[13px] font-semibold">
              <Link href={`/story/series/${gameId}`} className={order === 'new' ? 'text-[#9097a3]' : 'text-[#1a1d24]'}>1화부터</Link>
              <Link href={`/story/series/${gameId}?order=new`} className={order === 'new' ? 'text-[#1a1d24]' : 'text-[#9097a3]'}>최신화부터</Link>
            </div>
          </div>
          <ul className="divide-y divide-[#eef0f4]">
            {eps.map(e => (
              <li key={e.id}>
                <Link href={`/story/${e.id}`} className="group flex items-center gap-3 md:gap-4 py-3.5">
                  <span className="relative w-[64px] md:w-[88px] shrink-0 aspect-[4/3] rounded-[5px] overflow-hidden bg-[#eef1f6]">
                    {(e.thumbnail_url ?? s.cover) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={(e.thumbnail_url ?? s.cover)!} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[15px] md:text-[16px] font-bold text-[#1a1d24] group-hover:text-[#1f6fff] line-clamp-1">{e.no}화 {e.title}</span>
                      {isUp(e.published_at) && <span className="shrink-0 px-1 h-4 inline-flex items-center rounded-[3px] bg-[#ff3b47] text-white text-[10px] font-extrabold">UP</span>}
                    </span>
                    <span className="block mt-0.5 text-[13px] text-[#7a808c] line-clamp-1">{e.excerpt}</span>
                    <span className="block mt-0.5 text-[12px] text-[#a3a9b4] tabular-nums">{fmtDate(e.published_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {latest && latest.id !== first?.id && (
            <Link href={`/story/${latest.id}`} className="mt-3 flex h-12 items-center justify-center rounded-[8px] border border-[#dfe3ea] text-[14.5px] font-bold hover:border-[#1a1d24]">최신화 {latest.no}화 보기</Link>
          )}
        </section>

        {/* ── 연결된 웹툰 — 크리에이터가 올린 웹툰 컷 ── */}
        <section className="mt-10">
          <div className="flex items-end justify-between gap-3 mb-3">
            <h2 className="text-[17px] md:text-[19px] font-extrabold">웹툰으로 보기</h2>
            <Link href="/submit?kind=webtoon" className="text-[13px] font-semibold text-[#1f6fff]">웹툰 추가</Link>
          </div>
          {webtoons.length === 0 ? (
            <p className="text-[13.5px] text-[#7a808c] bg-[#f6f7f9] rounded-[8px] px-4 py-4">아직 이 작품의 웹툰이 없어요. 게임 장면을 컷으로 올리면 여기와 쇼츠 피드에 함께 보여요.</p>
          ) : webtoons.map(w => (
            <div key={w.id} className="mb-5">
              <p className="text-[14px] font-bold mb-2">{w.title}</p>
              <div className="-mx-4 md:mx-0 px-4 md:px-0 flex gap-2 overflow-x-auto no-scrollbar snap-x">
                {w.cuts.map((c, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={c.url} alt={`${w.title} ${i + 1}컷`} loading="lazy" className="snap-start h-[220px] md:h-[280px] w-auto rounded-[6px] bg-[#eef1f6] shrink-0" />
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
