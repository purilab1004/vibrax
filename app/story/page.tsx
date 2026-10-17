import Link from 'next/link'
import { getStoryData, getToonData, isUp, fmtDate, GENRE_KO, type StorySeries, type ToonSeries } from '@/lib/story/data'

// STORY 홈 — 웹툰 플랫폼처럼: 웹툰 · 웹소설 · 쇼츠 애니(준비 중) 를 나누고, 요일 연재 탭 → 추천 → 전체(정렬) + 실시간 인기.
// 게임 = 작품, 제작자 = 작가. 웹툰 = 회차에 게임 장면 컷이 있는 작품(컷만 세로로 읽기), 웹소설 = 글로 읽기.
export const revalidate = 120

type Kind = 'toon' | 'novel' | 'shorts'
const DAYS = [['', '요일전체'], ['mon', '월'], ['tue', '화'], ['wed', '수'], ['thu', '목'], ['fri', '금'], ['sat', '토'], ['sun', '일'], ['new', '신작'], ['done', '완결']] as const
const DAY_IDX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

// 연재 요일 = 1화가 올라온 요일 (한국 시간)
const dayOf = (s: StorySeries) => { const d = new Date(new Date(s.episodes[0]?.published_at ?? s.latestAt).getTime() + 9 * 3600_000); return d.getUTCDay() }
const isNew = (s: StorySeries) => Date.now() - new Date(s.episodes[0]?.published_at ?? 0).getTime() < 14 * 86400_000
// 오늘 요일(한국 시간) — 서버 렌더(120초 캐시) 시점 기준
const todayKo = () => DAY_KO[new Date(Date.now() + 9 * 3600_000).getUTCDay()]
// 웹툰 시리즈를 같은 카드 모양으로 쓰기 위한 변환
function toSeries(t: ToonSeries): StorySeries {
  return {
    game: { id: t.key, title: t.title, genre: t.genre ?? '', thumbnail_url: t.cover, teaser: null, intro: null, coin_cost: null, view_count: 0, studio_project_id: null },
    author: t.author, cover: t.cover, latestAt: t.latestAt, views: t.views,
    episodes: t.episodes.map((e) => ({ id: e.id, game_id: t.key, no: e.no, title: e.title, excerpt: '', thumbnail_url: e.thumbnail_url, published_at: e.created_at, view_count: e.view_count })),
  }
}
const score = (s: StorySeries) => s.views + s.game.view_count

function Cover({ s, className = '', fit = 'cover' }: { s: StorySeries; className?: string; fit?: 'cover' | 'contain' }) {
  return (
    <div className={`relative overflow-hidden rounded-[6px] bg-[#eef1f6] ${className}`}>
      {s.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.cover} alt="" loading="lazy" className={`absolute inset-0 w-full h-full object-${fit} group-hover:scale-[1.03] transition-transform duration-500`} />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[28px] font-black text-[#1a1d24]/15">{s.game.title.charAt(0)}</div>
      )}
      {isUp(s.latestAt) && <span className="absolute left-1.5 top-1.5 px-1.5 h-[18px] inline-flex items-center rounded-[3px] bg-[#00c73c] text-white text-[10.5px] font-extrabold">UP</span>}
    </div>
  )
}

export default async function StoryPage({ searchParams }: { searchParams: Promise<{ type?: string; day?: string; sort?: string; q?: string; genre?: string }> }) {
  const sp = await searchParams
  // 아직 웹툰이 하나도 없으면 첫 화면은 웹소설로
  const anyToon = !sp.type ? (await getToonData()).length > 0 : true
  const kind: Kind = sp.type === 'novel' || !anyToon ? 'novel' : sp.type === 'shorts' ? 'shorts' : 'toon'
  const day = DAYS.some(([d]) => d === sp.day) ? (sp.day as string) : ''
  const sort = sp.sort === 'update' || sp.sort === 'views' ? sp.sort : 'popular'
  const q = (sp.q ?? '').trim()
  // 웹툰 탭은 실제 웹툰(컷 원고)만, 웹소설 탭은 글 연재만 — 같은 작품이 둘 다면 각 탭에 따로 나온다
  const toons = kind === 'toon' ? await getToonData() : []
  const all: StorySeries[] = kind === 'toon' ? toons.map(toSeries) : await getStoryData()
  const pool = all
  let list = pool
  if (day === 'new') list = list.filter(isNew)
  else if (day === 'done') list = []                       // 완결 작품은 아직 없음
  else if (day) list = list.filter(s => dayOf(s) === DAY_IDX[day])
  if (sp.genre) list = list.filter(s => s.game.genre === sp.genre)
  if (q) list = list.filter(s => `${s.game.title} ${s.author} ${s.episodes.map(e => e.title).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
  const sorted = [...list].sort((a, b) => sort === 'update' ? b.latestAt.localeCompare(a.latestAt) : sort === 'views' ? b.views - a.views : score(b) - score(a))
  const recommend = [...list].sort((a, b) => score(b) - score(a)).slice(0, 3)
  const hot = [...pool].sort((a, b) => score(b) - score(a)).slice(0, 10)
  const today = todayKo()
  const dayName = day === 'new' ? '신작' : day === 'done' ? '완결' : day ? `${DAY_KO[DAY_IDX[day]]}요` : '전체'
  const kindName = kind === 'toon' ? '웹툰' : kind === 'novel' ? '웹소설' : '쇼츠 애니'
  const link = (o: Record<string, string>) => { const p = new URLSearchParams(); const v = { type: kind, day, sort: sort === 'popular' ? '' : sort, q, ...o }; for (const [k, x] of Object.entries(v)) if (x) p.set(k, x); const s = p.toString(); return `/story${s ? '?' + s : ''}` }
  // 웹툰은 컷만 보는 뷰어로, 웹소설은 글 뷰어로 — 작품 페이지에 방식 전달
  const seriesHref = (s: StorySeries) => (kind === 'toon' ? `/story/toon/${s.game.id}` : `/story/series/${s.game.id}`)

  return (
    <div className="min-h-screen bg-white text-[#1a1d24]">
      {/* ── 1단: 로고 · 종류 · 검색 ── */}
      <header className="border-b border-[#e8eaef]">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 h-12 md:h-14 flex items-center gap-4 md:gap-6">
          <Link href="/story" className="hidden md:inline text-[22px] font-black tracking-[-0.04em] shrink-0">STORY</Link>
          <nav className="flex items-center gap-3 md:gap-5 text-[14px] md:text-[16px] font-bold" aria-label="종류">
            {(['toon', 'novel', 'shorts'] as const).map((k) => (
              <Link key={k} href={`/story?type=${k}`} className={`whitespace-nowrap ${kind === k ? 'text-[#1a1d24]' : 'text-[#a3a9b4] hover:text-[#1a1d24]'}`}>
                {k === 'toon' ? '웹툰' : k === 'novel' ? '웹소설' : <>쇼츠 애니<sup className="ml-0.5 text-[9px] text-[#00c73c]">곧</sup></>}
              </Link>
            ))}
          </nav>
          <form action="/story" className="ml-auto hidden md:flex items-center gap-2 h-10 w-72 rounded-[4px] border border-[#dfe3ea] px-3 focus-within:border-[#1a1d24]">
            <input type="hidden" name="type" value={kind} />
            <input name="q" defaultValue={q} placeholder="제목/작가로 검색할 수 있습니다." aria-label="STORY 검색" className="flex-1 min-w-0 bg-transparent outline-none text-[14px] placeholder:text-[#a3a9b4]" />
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#1a1d24] shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" strokeLinecap="round" /></svg>
          </form>
        </div>
      </header>

      {kind === 'shorts' ? (
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-28 text-center">
          <p className="text-[22px] md:text-[28px] font-black">쇼츠 애니 준비 중</p>
          <p className="mt-2 text-[14px] text-[#6b7280]">게임 속 장면이 짧은 애니메이션으로 연재될 예정이에요.</p>
          <Link href="/story" className="mt-5 inline-flex h-10 items-center px-5 rounded-[4px] bg-[#1a1d24] text-white text-[14px] font-bold">웹툰 보러 가기</Link>
        </div>
      ) : (
        <>
          {/* ── 2단: 요일 탭 ── */}
          <div className="border-b border-[#e8eaef] sticky top-0 z-20 bg-white/95 backdrop-blur">
            <nav className="max-w-[1200px] mx-auto px-4 md:px-6 flex gap-4 md:gap-7 overflow-x-auto no-scrollbar" aria-label="연재 요일">
              {DAYS.map(([d, name]) => {
                const on = day === d
                return <Link key={d || 'all'} href={link({ day: d })} className={`shrink-0 py-3 text-[14px] md:text-[15px] font-bold border-b-[3px] ${on ? 'text-[#1a1d24] border-[#00c73c]' : 'text-[#6b7280] border-transparent hover:text-[#1a1d24]'}`}>{name}{name === today && !on ? <span className="ml-0.5 text-[10px] text-[#00c73c]">●</span> : null}</Link>
              })}
            </nav>
          </div>

          {/* 모바일 검색 */}
          <form action="/story" className="md:hidden mx-4 mt-4 flex items-center gap-2 h-11 rounded-[4px] border border-[#dfe3ea] px-3">
            <input type="hidden" name="type" value={kind} />
            <input name="q" defaultValue={q} placeholder="제목/작가 검색" aria-label="STORY 검색" className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-[#a3a9b4]" />
          </form>

          <div className="max-w-[1200px] mx-auto px-4 md:px-6 pb-20">
            {q && <p className="mt-6 text-[14px] text-[#6b7280]">‘<b className="text-[#1a1d24]">{q}</b>’ 검색 결과 {list.length}작품</p>}

            {/* ── 추천 + 오른쪽 배너 ── */}
            {!q && recommend.length > 0 && (
              <section className="mt-7 md:mt-9">
                <h2 className="text-[19px] md:text-[21px] font-extrabold tracking-[-0.02em] mb-3.5">추천 {dayName === '전체' ? '' : dayName + ' '}{kindName}</h2>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
                  <div className="grid grid-cols-3 gap-3 md:gap-4">
                    {recommend.map(s => {
                      const last = s.episodes[s.episodes.length - 1]
                      return (
                        <Link key={s.game.id} href={seriesHref(s)} className="group block min-w-0">
                          <Cover s={s} className="aspect-[4/3] ring-1 ring-black/5" />
                          <p className="mt-2.5 text-[14.5px] md:text-[16px] font-bold leading-snug line-clamp-1 group-hover:underline">{s.game.title}</p>
                          <p className="mt-0.5 text-[12.5px] text-[#4b5563] truncate">{s.author}</p>
                          <p className="mt-0.5 text-[12px] text-[#6b7280] truncate">{last ? `${last.no}화` : ''}</p>
                          <p className="mt-0.5 text-[12px] text-[#9097a3]">★ {(9 + Math.min(0.99, score(s) / 5000)).toFixed(2)}</p>
                        </Link>
                      )
                    })}
                  </div>
                  <Link href="/studio" className="hidden lg:flex relative overflow-hidden rounded-[6px] bg-gradient-to-br from-[#1f2937] via-[#2563eb] to-[#38bdf8] p-6 flex-col justify-end text-white min-h-[240px]">
                    <span className="absolute right-4 top-4 text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-[3px]">CREATOR</span>
                    <p className="text-[24px] font-black leading-tight">내 게임으로<br />연재 시작하기</p>
                    <p className="mt-2 text-[13px] text-white/80">게임을 게시하면 1화가 자동으로 올라와요</p>
                  </Link>
                </div>
              </section>
            )}

            {/* ── 전체 + 실시간 인기 ── */}
            <div className="mt-10 md:mt-12 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
              <section>
                <div className="flex items-end justify-between gap-3 mb-3.5">
                  <h2 className="text-[19px] md:text-[21px] font-extrabold tracking-[-0.02em]">{q ? '검색 결과' : `${dayName} ${kindName}`}</h2>
                  <div className="flex items-center gap-1.5 text-[13px]">
                    {([['popular', '인기순'], ['update', '업데이트순'], ['views', '조회순']] as const).map(([v, l], i) => (
                      <span key={v} className="flex items-center gap-1.5">{i > 0 && <span className="text-[#d1d5db]">·</span>}<Link href={link({ sort: v === 'popular' ? '' : v })} className={sort === v ? 'text-[#00c73c] font-bold' : 'text-[#6b7280] hover:text-[#1a1d24]'}>{l}</Link></span>
                    ))}
                  </div>
                </div>
                {sorted.length === 0 ? (
                  <div className="py-20 text-center text-[14px] text-[#6b7280]">{day === 'done' ? '아직 완결된 작품이 없어요.' : q ? '검색 결과가 없어요.' : kind === 'toon' && pool.length === 0 ? '아직 연재 중인 웹툰이 없어요. 게임 장면 컷으로 웹툰을 올리면 여기에 연재돼요.' : `이 요일에 연재되는 ${kindName}이 아직 없어요.`}</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-3 gap-y-6">
                    {sorted.map(s => (
                      <Link key={s.game.id} href={seriesHref(s)} className="group block min-w-0">
                        <Cover s={s} className="aspect-[3/4] ring-1 ring-black/5" />
                        <p className="mt-2 text-[13.5px] md:text-[14.5px] font-bold leading-snug line-clamp-1 group-hover:underline">{s.game.title}</p>
                        <p className="mt-0.5 text-[12px] text-[#6b7280] truncate">{s.author}</p>
                        <p className="mt-0.5 text-[11.5px] text-[#9097a3] truncate">{GENRE_KO[s.game.genre] ?? s.game.genre} · {s.episodes.length}화 · {fmtDate(s.latestAt)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <aside>
                <div className="flex items-end justify-between mb-3.5">
                  <h2 className="text-[19px] md:text-[21px] font-extrabold tracking-[-0.02em]">실시간 인기{kindName}</h2>
                </div>
                <ol className="divide-y divide-[#f0f2f5] border-t border-[#e8eaef]">
                  {hot.map((s, i) => (
                    <li key={s.game.id}>
                      <Link href={seriesHref(s)} className="group flex items-center gap-3 py-2.5">
                        <Cover s={s} className="w-[54px] aspect-[3/4] shrink-0" />
                        <span className={`w-5 shrink-0 text-center text-[17px] font-black tabular-nums ${i < 3 ? 'text-[#00c73c]' : 'text-[#1a1d24]'}`}>{i + 1}</span>
                        <span className="min-w-0">
                          <span className="block text-[14px] font-bold truncate group-hover:underline">{s.game.title}</span>
                          <span className="block text-[12px] text-[#6b7280] truncate">{s.author}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
