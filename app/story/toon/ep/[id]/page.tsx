import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getToonData } from '@/lib/story/data'

// 웹툰 회차 — 컷을 세로로 이어서
export const revalidate = 120

export default async function ToonEpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = (await getToonData()).find((x) => x.episodes.some((e) => e.id === id))
  const e = s?.episodes.find((x) => x.id === id)
  if (!s || !e) notFound()
  const prev = s.episodes[e.no - 2], next = s.episodes[e.no]
  return (
    <div className="min-h-screen bg-[#111] text-white">
      <div className="sticky top-0 z-20 bg-[#111]/95 border-b border-white/10">
        <div className="max-w-[720px] mx-auto px-4 h-12 flex items-center gap-2">
          <Link href={`/story/toon/${s.key}`} className="text-white/70 hover:text-white" aria-label="목록">‹</Link>
          <p className="flex-1 min-w-0 truncate text-[14px] font-bold">{s.title} · {e.no}화 {e.title}</p>
        </div>
      </div>
      <div className="max-w-[720px] mx-auto flex flex-col">
        {e.cuts.map((c, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={c.url} alt={`${e.title} ${i + 1}컷`} loading={i < 2 ? 'eager' : 'lazy'} className="w-full h-auto block" />
        ))}
      </div>
      <nav className="max-w-[720px] mx-auto px-4 py-5 grid grid-cols-3 gap-2 text-[14px] font-bold">
        {prev ? <Link href={`/story/toon/ep/${prev.id}`} className="h-11 inline-flex items-center justify-center rounded-[4px] border border-white/20">이전화</Link> : <span />}
        <Link href={`/story/toon/${s.key}`} className="h-11 inline-flex items-center justify-center text-white/70">목록</Link>
        {next ? <Link href={`/story/toon/ep/${next.id}`} className="h-11 inline-flex items-center justify-center rounded-[4px] bg-white text-[#111]">다음화</Link> : <span className="h-11 inline-flex items-center justify-center text-white/40 text-[13px]">다음 화 준비 중</span>}
      </nav>
    </div>
  )
}
