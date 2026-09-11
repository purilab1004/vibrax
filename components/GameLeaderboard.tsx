'use client'
// 게임 상세 — 회원 최고점 TOP 10. 이 안에 들면 플레이 중 다음 게임 transport 가 열린다.
import { useEffect, useState } from 'react'
import { TOP_N, type Leaderboard } from '@/lib/games/leaderboard'

export default function GameLeaderboard({ gameId }: { gameId: string }) {
  const [lb, setLb] = useState<Leaderboard | null>(null)
  useEffect(() => { let alive = true; fetch(`/api/games/${gameId}/leaderboard`).then(r => r.json()).then(j => { if (alive && j && !j.error) setLb(j) }).catch(() => {}); return () => { alive = false } }, [gameId])
  return (
    <section className="mt-8 border border-[#ebe4d6] bg-[#fcfaf5]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebe4d6]">
        <h2 className="font-pixel text-[11px] tracking-widest text-[#241f17]">🏆 TOP {TOP_N}</h2>
        <span className="text-[11px] text-[#857a68]">{lb ? (lb.full && lb.threshold != null ? `${(lb.threshold + 1).toLocaleString()}점부터 순위 진입 → 다음 게임 이동` : '순위에 들면 다음 게임으로 이동할 수 있어요') : ''}</span>
      </div>
      {!lb ? <p className="px-4 py-4 text-[12px] text-[#9d9280]">불러오는 중…</p>
        : lb.top.length === 0 ? <p className="px-4 py-5 text-[12.5px] text-[#6b6152]">아직 기록이 없어요. 첫 1위가 되어 보세요!</p>
        : <ol className="divide-y divide-[#f1ede4]">
          {lb.top.map((r, i) => (
            <li key={r.user_id} className={`flex items-center gap-3 px-4 py-2 text-[13px] ${lb.me && lb.me.rank === i + 1 ? 'bg-[#eef4ff]' : ''}`}>
              <span className={`w-6 text-center font-pixel text-[11px] ${i === 0 ? 'text-[#d97706]' : i < 3 ? 'text-[#6b6152]' : 'text-[#b5ab98]'}`}>{i + 1}</span>
              <span className="flex-1 truncate text-[#241f17]">{r.agent_name || r.username}{lb.me && lb.me.rank === i + 1 ? <span className="ml-1.5 text-[10px] text-[#2563eb] font-bold">나</span> : null}</span>
              <span className="tabular-nums font-semibold text-[#241f17]">{r.best.toLocaleString()}</span>
            </li>
          ))}
        </ol>}
      {lb?.me && lb.me.rank === 0 && <p className="px-4 py-2 text-[11.5px] text-[#6b6152] border-t border-[#f1ede4]">내 최고 {lb.me.best.toLocaleString()}점 — 아직 순위 밖이에요.</p>}
    </section>
  )
}
