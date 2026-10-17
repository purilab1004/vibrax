import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getToonData, fmtDate, isUp } from '@/lib/story/data'

// 웹툰 작품 — 회차 목록(컷 원고)
export const revalidate = 120

export default async function ToonSeriesPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const s = (await getToonData()).find((x) => x.key === key)
  if (!s) notFound()
  const first = s.episodes[0]
  return (
    <div className="min-h-screen bg-white text-[#1a1d24]">
      <header className="border-b border-[#e8eaef]">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 flex gap-5 items-end">
          <div className="relative w-[110px] md:w-[150px] shrink-0 aspect-[3/4] rounded-[6px] overflow-hidden bg-[#eef1f6]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.cover && <img src={s.cover} alt={s.title} className="absolute inset-0 w-full h-full object-cover" />}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[#00c73c]">웹툰 · 연재 중</p>
            <h1 className="mt-1 text-[22px] md:text-[30px] font-black tracking-[-0.03em] leading-tight">{s.title}</h1>
            <p className="mt-1 text-[13.5px] text-[#6b7280]">{s.author} · 총 {s.episodes.length}화</p>
            <div className="mt-4 flex gap-2">
              {first && <Link href={`/story/toon/ep/${first.id}`} className="h-11 px-6 inline-flex items-center rounded-[4px] bg-[#1a1d24] text-white text-[14px] font-bold">첫화 보기</Link>}
              {s.gameId && <Link href={`/games/${s.gameId}`} className="h-11 px-6 inline-flex items-center rounded-[4px] bg-[#1f6fff] text-white text-[14px] font-bold">게임 플레이</Link>}
            </div>
          </div>
        </div>
      </header>
      <ul className="max-w-4xl mx-auto px-4 md:px-6 divide-y divide-[#eef0f4]">
        {[...s.episodes].reverse().map((e) => (
          <li key={e.id}>
            <Link href={`/story/toon/ep/${e.id}`} className="group flex items-center gap-4 py-3">
              <span className="relative w-[96px] shrink-0 aspect-[4/3] rounded-[4px] overflow-hidden bg-[#eef1f6]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {e.thumbnail_url && <img src={e.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold group-hover:underline">{e.no}화 {e.title}{isUp(e.created_at) && <span className="ml-1.5 px-1 rounded-[3px] bg-[#00c73c] text-white text-[10px]">UP</span>}</span>
                <span className="block text-[12px] text-[#9097a3]">{fmtDate(e.created_at)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
