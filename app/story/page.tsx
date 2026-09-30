import Link from 'next/link'
import { getStoryData, isUp, fmtDate, GENRE_KO, type StorySeries } from '@/lib/story/data'

// STORY 홈 — 웹소설 플랫폼(리디 웹소설) 구성: 배너 캐러셀 → 새 회차 가로 줄 → 실시간 랭킹 → 전체 작품.
// 게임 = 작품, 제작자 = 작가, 장르 = 카테고리 탭. 서버 렌더 + 캐시(JS 없이 동작).
export const revalidate = 120

const GENRES = ['action', 'adventure', 'strategy', 'sports', 'arcade'] as const

function Cover({ s, className = '' }: { s: StorySeries; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[6px] bg-[#eef1f6] ${className}`}>
      {s.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.cover} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[28px] font-black text-[#1a1d24]/15">{s.game.title.charAt(0)}</div>
      )}
      <div className="absolute left-1.5 top-1.5 flex gap-1">
        {isUp(s.latestAt) && <span className="px-1.5 h-[18px] inline-flex items-center rounded-[3px] bg-[#ff3b47] text-white text-[10.5px] font-extrabold">UP</span>}
      </div>
      <span className="absolute left-0 bottom-0 px-1.5 py-[3px] rounded-tr-[5px] bg-black/60 text-white text-[10.5px] font-bold tabular-nums">{s.episodes.length}화</span>
    </div>
  )
}

function SeriesCard({ s }: { s: StorySeries }) {
  return (
    <Link href={`/story/series/${s.game.id}`} className="group block min-w-0">
      <Cover s={s} className="aspect-[3/4] ring-1 ring-black/5" />
      <p className="mt-2 text-[14px] font-bold leading-snug text-[#1a1d24] line-clamp-2 group-hover:text-[#1f6fff]">{s.game.title}</p>
      <p className="mt-0.5 text-[12px] text-[#7a808c] truncate">{s.author}</p>
      <p className="mt-0.5 text-[12px] text-[#1f6fff] font-semibold">연재 중 · {GENRE_KO[s.game.genre] ?? s.game.genre}</p>
    </Link>
  )
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3.5 md:mb-4">
      <h2 className="text-[18px] md:text-[21px] font-extrabold tracking-[-0.02em] text-[#1a1d24]">{title}</h2>
      {sub && <span className="text-[12.5px] text-[#9097a3]">{sub}</span>}
    </div>
  )
}

export default async function StoryPage({ searchParams }: { searchParams: Promise<{ genre?: string; q?: string }> }) {
  const { genre, q: qRaw } = await searchParams
  const q = (qRaw ?? '').trim()
  const all = await getStoryData()
  const byGenre = genre ? all.filter(s => s.game.genre === genre) : all
  const list = q ? byGenre.filter(s => `${s.game.title} ${s.author} ${s.episodes.map(e => e.title).join(' ')}`.toLowerCase().includes(q.toLowerCase())) : byGenre
  const banners = list.slice(0, 6)
  const fresh = list.flatMap(s => s.episodes.slice(-1).map(e => ({ s, e }))).sort((a, b) => (b.e.published_at ?? '').localeCompare(a.e.published_at ?? '')).slice(0, 12)
  const ranking = [...list].sort((a, b) => (b.views + b.game.view_count) - (a.views + a.game.view_count)).slice(0, 9)
  const tabs = [{ id: '', name: '전체' }, ...GENRES.filter(g => all.some(s => s.game.genre === g)).map(g => ({ id: g, name: GENRE_KO[g] }))]
  const href = (g: string) => (g ? `/story?genre=${g}` : '/story')

  return (
    <div className="min-h-screen bg-white text-[#1a1d24]">
      {/* ── 상단: 제목 · 장르 탭 · 검색 ── */}
      <div className="border-b border-[#e8eaef] bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-5 md:pt-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[26px] md:text-[34px] font-black tracking-[-0.035em] leading-none">STORY</h1>
              <p className="mt-1.5 text-[13px] md:text-[14px] text-[#6b7280]">게임마다 연재되는 웹소설. 다 읽으면 바로 그 게임을 플레이하세요.</p>
            </div>
            <form action="/story" className="hidden md:flex items-center gap-2 h-10 w-72 rounded-full bg-[#f3f5f8] px-4 focus-within:ring-2 focus-within:ring-[#1f6fff]/40">
              {genre && <input type="hidden" name="genre" value={genre} />}
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#9097a3] shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" strokeLinecap="round" /></svg>
              <input name="q" defaultValue={q} placeholder="작품·작가·회차 검색" aria-label="STORY 검색" className="flex-1 min-w-0 bg-transparent outline-none text-[14px] placeholder:text-[#a3a9b4]" />
            </form>
          </div>
          <nav className="mt-4 flex gap-5 md:gap-7 overflow-x-auto no-scrollbar" aria-label="장르">
            {tabs.map(t => {
              const on = (genre ?? '') === t.id
              return <Link key={t.id || 'all'} href={href(t.id)} className={`shrink-0 pb-3 text-[15px] md:text-[16px] font-bold border-b-[3px] ${on ? 'text-[#1a1d24] border-[#1a1d24]' : 'text-[#9097a3] border-transparent hover:text-[#1a1d24]'}`}>{t.name}</Link>
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-20">
        {/* 모바일 검색 */}
        <form action="/story" className="md:hidden mt-4 flex items-center gap-2 h-11 rounded-full bg-[#f3f5f8] px-4">
          {genre && <input type="hidden" name="genre" value={genre} />}
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#9097a3] shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" strokeLinecap="round" /></svg>
          <input name="q" defaultValue={q} placeholder="작품·작가·회차 검색" aria-label="STORY 검색" className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-[#a3a9b4]" />
        </form>

        {q && <p className="mt-5 text-[14px] text-[#6b7280]">‘<b className="text-[#1a1d24]">{q}</b>’ 검색 결과 {list.length}작품</p>}

        {list.length === 0 ? (
          <div className="py-28 text-center">
            <p className="text-[15px] text-[#6b7280]">{q ? '검색 결과가 없어요. 다른 단어로 찾아보세요.' : '아직 연재 중인 작품이 없어요. 게임을 게시하면 1화가 자동으로 올라옵니다.'}</p>
            <Link href="/studio" className="mt-4 inline-flex h-10 items-center px-5 rounded-full bg-[#1f6fff] text-white text-[14px] font-bold">게임 만들기</Link>
          </div>
        ) : (
          <>
            {/* ── 배너 캐러셀 — 스크롤 스냅(모바일 1장, PC 2장씩) ── */}
            {!q && (
              <section className="mt-5 md:mt-7 -mx-4 md:mx-0" aria-label="추천 작품">
                <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar px-4 md:px-0 scroll-px-4 md:scroll-px-0">
                  {banners.map(s => {
                    const last = s.episodes[s.episodes.length - 1]
                    return (
                      <Link key={s.game.id} href={`/story/series/${s.game.id}`} className="group snap-start shrink-0 w-[86%] sm:w-[62%] md:w-[calc(50%-8px)] relative overflow-hidden rounded-[14px] bg-[#1a1d24] aspect-[4/3] md:aspect-[16/10]">
                        {s.cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-[1.03] transition-transform duration-500" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 text-white">
                          <div className="flex gap-1.5 mb-2">
                            {isUp(s.latestAt) && <span className="px-1.5 h-5 inline-flex items-center rounded-[3px] bg-[#ff3b47] text-[11px] font-extrabold">UP</span>}
                            <span className="px-1.5 h-5 inline-flex items-center rounded-[3px] bg-white/20 text-[11px] font-bold backdrop-blur-sm">{s.episodes.length}화 연재 중</span>
                          </div>
                          <p className="text-[21px] md:text-[27px] font-black leading-tight tracking-[-0.03em] line-clamp-2">{s.game.title}</p>
                          <p className="mt-1 text-[13px] md:text-[14px] text-white/80 line-clamp-1">{last ? `${last.no}화 ${last.title}` : s.game.teaser}</p>
                          <p className="mt-0.5 text-[12px] text-white/60">{s.author}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── 새로 올라온 회차 — 가로 줄 ── */}
            {!q && fresh.length > 0 && (
              <section className="mt-9 md:mt-12">
                <SectionHead title="새로 올라온 회차" sub="최신 순" />
                <div className="-mx-4 md:mx-0 px-4 md:px-0 flex gap-3 md:gap-4 overflow-x-auto no-scrollbar">
                  {fresh.map(({ s, e }) => (
                    <Link key={e.id} href={`/story/${e.id}`} className="group shrink-0 w-[118px] md:w-[152px]">
                      <Cover s={s} className="aspect-[3/4] ring-1 ring-black/5" />
                      <p className="mt-2 text-[13.5px] font-bold leading-snug line-clamp-1 group-hover:text-[#1f6fff]">{s.game.title}</p>
                      <p className="mt-0.5 text-[12px] text-[#6b7280] line-clamp-2 leading-snug">{e.no}화 {e.title}</p>
                      <p className="mt-0.5 text-[11.5px] text-[#a3a9b4] tabular-nums">{fmtDate(e.published_at)}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* ── 실시간 랭킹 — 번호는 순위 ── */}
            {ranking.length > 1 && (
              <section className="mt-9 md:mt-12">
                <SectionHead title="많이 보는 작품" sub="조회 기준" />
                <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3.5">
                  {ranking.map((s, i) => (
                    <li key={s.game.id}>
                      <Link href={`/story/series/${s.game.id}`} className="group flex items-center gap-3">
                        <Cover s={s} className="w-[60px] md:w-[68px] shrink-0 aspect-[3/4] ring-1 ring-black/5" />
                        <span className={`w-6 shrink-0 text-center text-[19px] font-black tabular-nums ${i < 3 ? 'text-[#1f6fff]' : 'text-[#1a1d24]'}`}>{i + 1}</span>
                        <span className="min-w-0">
                          <span className="block text-[15px] font-bold leading-snug line-clamp-1 group-hover:text-[#1f6fff]">{s.game.title}</span>
                          <span className="block mt-0.5 text-[12.5px] text-[#7a808c] truncate">{s.author}</span>
                          <span className="block mt-0.5 text-[12px] text-[#a3a9b4]">{GENRE_KO[s.game.genre] ?? s.game.genre} · {s.episodes.length}화</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* ── 전체 작품 ── */}
            <section className="mt-9 md:mt-12">
              <SectionHead title={q ? '검색 결과' : genre ? `${GENRE_KO[genre] ?? genre} 작품` : '전체 작품'} sub={`${list.length}작품`} />
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 md:gap-x-5 gap-y-6">
                {list.map(s => <SeriesCard key={s.game.id} s={s} />)}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
