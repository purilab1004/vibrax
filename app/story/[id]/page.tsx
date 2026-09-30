import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getStoryData, getEpisode, fmtDate } from '@/lib/story/data'
import { stripHtml, makeExcerpt } from '@/lib/blog/excerpt'
import StoryViewPing from '@/components/story/StoryViewPing'
import StoryActions from '@/components/story/StoryActions'

// STORY 회차 읽기 — 웹소설 뷰어. 검색엔진·AI 크롤러가 본문을 읽도록 서버 렌더.
export const revalidate = 300

async function load(id: string) {
  const post = await getEpisode(id)
  if (!post) return null
  const series = post.game_id ? (await getStoryData()).find(s => s.game.id === post.game_id) ?? null : null
  const idx = series ? series.episodes.findIndex(e => e.id === id) : -1
  return { post, series, no: idx + 1, prev: series && idx > 0 ? series.episodes[idx - 1] : null, next: series && idx >= 0 ? series.episodes[idx + 1] ?? null : null }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const d = await load(id)
  if (!d) return { title: 'STORY' }
  const title = d.series ? `${d.series.game.title} ${d.no}화 — ${d.post.title}` : d.post.title
  const description = d.post.excerpt || makeExcerpt(d.post.content)
  return {
    title,
    description,
    alternates: { canonical: `https://vibrexcup.com/story/${id}` },
    openGraph: { type: 'article', title, description, url: `https://vibrexcup.com/story/${id}`, publishedTime: d.post.published_at ?? undefined, modifiedTime: d.post.updated_at, ...(d.post.thumbnail_url ? { images: [{ url: d.post.thumbnail_url }] } : {}) },
  }
}

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = await load(id)
  if (!d) redirect('/story')   // 지워진 옛 BLOG 글 링크 등 — STORY 홈으로
  const { post, series, no, prev, next } = d
  const game = series?.game

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Chapter',
    name: post.title,
    ...(series ? { position: no, isPartOf: { '@type': 'CreativeWorkSeries', name: series.game.title, url: `https://vibrexcup.com/story/series/${series.game.id}` } } : {}),
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    author: { '@type': 'Person', name: series?.author ?? 'Vibrexcup' },
    publisher: { '@type': 'Organization', name: 'Vibrexcup', url: 'https://vibrexcup.com' },
    mainEntityOfPage: `https://vibrexcup.com/story/${post.id}`,
    description: post.excerpt || stripHtml(post.content).slice(0, 200),
    ...(post.thumbnail_url ? { image: post.thumbnail_url } : {}),
  }

  const playBtn = game && (
    <Link href={`/games/${game.id}`} className="flex h-[52px] items-center justify-center gap-2 rounded-[10px] bg-[#1f6fff] text-white text-[16px] font-extrabold hover:bg-[#1a5fe0]">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden><path d="M8 5v14l11-7-11-7Z" /></svg>
      지금 플레이하기
    </Link>
  )

  return (
    <div className="min-h-screen bg-white text-[#1a1d24]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <StoryViewPing postId={post.id} />

      {/* 뷰어 상단 — 작품명 · 회차 */}
      <div className="sticky top-[calc(3.5rem+var(--st,0px))] z-20 bg-white/95 backdrop-blur border-b border-[#eef0f4]">
        <div className="max-w-[720px] mx-auto px-4 h-12 flex items-center gap-2">
          <Link href={series ? `/story/series/${series.game.id}` : '/story'} aria-label="작품으로" className="-ml-1 p-1 text-[#6b7280] hover:text-[#1a1d24]">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <p className="min-w-0 flex-1 text-[14px] font-bold truncate">{series ? `${series.game.title} · ${no}화` : 'STORY'}</p>
          {game && <Link href={`/games/${game.id}`} className="shrink-0 h-8 px-3 inline-flex items-center rounded-full bg-[#1f6fff] text-white text-[12.5px] font-extrabold">플레이</Link>}
        </div>
      </div>

      <article className="max-w-[720px] mx-auto px-5 md:px-4 pt-8 md:pt-12 pb-10">
        <header className="text-center">
          {series && <p className="text-[13.5px] font-bold text-[#1f6fff]">{no}화</p>}
          <h1 className="mt-1.5 text-[23px] md:text-[30px] font-black leading-[1.3] tracking-[-0.03em] text-balance">{post.title}</h1>
          <p className="mt-2 text-[12.5px] text-[#9097a3] tabular-nums">{series?.author ?? 'Vibrexcup'} · {fmtDate(post.published_at)}</p>
        </header>
        <hr className="mt-7 mb-8 w-10 mx-auto border-t-2 border-[#1a1d24]" />
        {/* content 는 RLS 로 관리자·서버만 쓴다 — 신뢰 경계 안의 HTML */}
        <div className="story-body" dangerouslySetInnerHTML={{ __html: post.content }} />

        <div className="mt-10 flex justify-center"><StoryActions postId={post.id} size="md" /></div>

        {/* 다 읽은 뒤 — 게임으로 */}
        {game && (
          <div className="mt-10 rounded-[14px] border border-[#e3e7ee] bg-[#f6f8fb] p-4 md:p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="flex gap-3 items-center min-w-0 flex-1">
              {game.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.thumbnail_url} alt="" className="w-[52px] aspect-[9/16] object-cover rounded-[6px] shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[12.5px] text-[#6b7280]">{no}화의 무대를 직접 뛰어 보세요</p>
                <p className="text-[16px] font-extrabold truncate">{game.title}</p>
              </div>
            </div>
            <div className="sm:w-56">{playBtn}</div>
          </div>
        )}
      </article>

      {/* 이전 / 다음 화 */}
      {series && (
        <nav className="border-t border-[#eef0f4]" aria-label="회차 이동">
          <div className="max-w-[720px] mx-auto px-4 py-4 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            {prev ? <Link href={`/story/${prev.id}`} className="h-11 inline-flex items-center justify-center rounded-[8px] border border-[#dfe3ea] text-[14px] font-bold hover:border-[#1a1d24]">이전화</Link> : <span className="h-11 inline-flex items-center justify-center rounded-[8px] border border-[#eef0f4] text-[14px] font-bold text-[#c3c8d0]">첫 화</span>}
            <Link href={`/story/series/${series.game.id}`} className="h-11 px-4 inline-flex items-center justify-center rounded-[8px] text-[14px] font-bold text-[#6b7280] hover:text-[#1a1d24]">목록</Link>
            {next ? <Link href={`/story/${next.id}`} className="h-11 inline-flex items-center justify-center rounded-[8px] bg-[#1a1d24] text-white text-[14px] font-bold">다음화</Link> : <span className="h-11 inline-flex items-center justify-center rounded-[8px] bg-[#f3f5f8] text-[13px] font-bold text-[#9097a3]">다음 화 준비 중</span>}
          </div>
        </nav>
      )}
    </div>
  )
}
