'use client'
// 내정보 > 내 아바타·AJ — 내 AI 아바타의 플레이 학습 현황 (게임별 정책 버전·규칙·최고점, 장르별 학습 레벨)
// 장르별 학습 난이도: 규칙이 단순한 장르는 빨리 오르고(액션/스포츠), 전략·어드벤처는 더 많은 학습이 필요.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Row { game_id: string; version: number; rules: unknown[]; tips: string[]; best_score: number | null; updated_at: string; games: { title: string; genre: string; thumbnail_url: string | null } | null }
const GENRE: Record<string, { label: string; color: string; difficulty: number; why: string }> = {
  action: { label: 'ACTION', color: '#dc2626', difficulty: 2, why: '반사 규칙 위주 — 빨리 배움' },
  sports: { label: 'SPORTS', color: '#059669', difficulty: 2, why: '타이밍·위치 규칙' },
  adventure: { label: 'ADVENTURE', color: '#d97706', difficulty: 3, why: '탐험·선택이 많아 규칙이 복잡' },
  strategy: { label: 'STRATEGY', color: '#2563eb', difficulty: 4, why: '수읽기·자원 관리 — 가장 오래 걸림' },
}
const XP_PER_LEVEL = 40
const xpOf = (r: Row) => r.version * 10 + (Array.isArray(r.rules) ? r.rules.length : 0) * 6 + (r.best_score && r.best_score > 0 ? 12 : 0)

export default function AiLearningSection() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    createClient().from('aj_play_policies').select('game_id,version,rules,tips,best_score,updated_at,games(title,genre,thumbnail_url)').order('updated_at', { ascending: false }).limit(200)
      .then(({ data, error }) => { if (error) { setMissing(true); setRows([]) } else setRows((data as unknown as Row[]) ?? []) })
  }, [])
  if (rows === null) return <div className="h-28 rounded-xl bg-[#f6f2ea] animate-pulse" />
  const byGenre: Record<string, { xp: number; games: number }> = {}
  for (const r of rows) { const g = r.games?.genre ?? 'action'; const b = (byGenre[g] ??= { xp: 0, games: 0 }); b.xp += xpOf(r); b.games++ }
  const totalXp = rows.reduce((a, r) => a + xpOf(r), 0)
  const totalRules = rows.reduce((a, r) => a + (Array.isArray(r.rules) ? r.rules.length : 0), 0)
  const totalLessons = rows.reduce((a, r) => a + r.version, 0)
  return (
    <div className="rounded-xl border border-[#ebe4d6] bg-[#fcfaf5] p-4 md:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><p className="font-pixel text-[9px] tracking-[0.3em] text-[#2563eb]">AI PLAY LEARNING</p><h3 className="text-[15px] font-bold text-[#241f17] mt-1">내 아바타 플레이 학습 현황</h3><p className="text-[12px] text-[#857a68] mt-0.5">게임에 아바타를 참여시키고 채팅으로 가르치면 게임별로 규칙이 쌓여요. 장르마다 학습 난이도가 달라 레벨이 오르는 속도가 다릅니다.</p></div>
        <div className="flex gap-2">
          {[['가르친 횟수', totalLessons], ['학습된 규칙', totalRules], ['학습한 게임', rows.length]].map(([l, v]) => <div key={l as string} className="rounded-lg bg-white border border-[#ebe4d6] px-3 py-2 min-w-[78px] text-center"><p className="text-[10px] text-[#857a68] font-semibold">{l}</p><p className="text-[18px] font-extrabold text-[#241f17] leading-none mt-0.5 tabular-nums">{v as number}</p></div>)}
        </div>
      </div>
      {/* 장르별 레벨 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(GENRE).map(([g, meta]) => {
          const b = byGenre[g] ?? { xp: 0, games: 0 }
          const need = XP_PER_LEVEL * meta.difficulty
          const level = Math.floor(b.xp / need) + 1, into = b.xp % need, pct = Math.round(into / need * 100)
          return (
            <div key={g} className="rounded-lg bg-white border border-[#ebe4d6] px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="font-pixel text-[9px] px-1.5 py-0.5 rounded text-white" style={{ background: meta.color }}>{meta.label}</span><span className="text-[12px] text-[#857a68]">난이도 {'★'.repeat(meta.difficulty)}{'☆'.repeat(4 - meta.difficulty)}</span></div>
                <span className="text-[13px] font-extrabold text-[#241f17]">Lv.{level}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#f1ece2] overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} /></div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[#9d9280]"><span>{meta.why}</span><span className="tabular-nums">{into}/{need} XP · 게임 {b.games}</span></div>
            </div>
          )
        })}
      </div>
      {/* 게임별 */}
      {missing ? <p className="text-[12px] text-[#9d9280]">학습 테이블이 아직 준비되지 않았어요.</p> : rows.length === 0 ? (
        <p className="text-[12.5px] text-[#857a68] rounded-lg border border-dashed border-[#e6dfd0] px-4 py-5 text-center">아직 학습한 게임이 없어요. 게임을 열고 <b>게임 참여</b> → 채팅으로 &ldquo;공이 오른쪽이면 미리 오른쪽으로&rdquo;처럼 가르쳐 보세요. <Link href="/games" className="text-[#2563eb] font-semibold hover:underline">게임 보러 가기 →</Link></p>
      ) : (
        <ul className="divide-y divide-[#ebe4d6] border-y border-[#ebe4d6]">
          {rows.map(r => { const g = GENRE[r.games?.genre ?? 'action'] ?? GENRE.action; const n = Array.isArray(r.rules) ? r.rules.length : 0; return (
            <li key={r.game_id} className="flex items-center gap-3 py-2.5">
              <div className="w-12 h-8 rounded-md overflow-hidden bg-[#f1ece2] shrink-0">{r.games?.thumbnail_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.games.thumbnail_url} alt="" className="w-full h-full object-cover" />}</div>
              <div className="min-w-0 flex-1"><Link href={`/games/${r.game_id}`} className="text-[13.5px] font-semibold text-[#241f17] hover:text-[#2563eb] truncate block">{r.games?.title ?? '게임'}</Link><p className="text-[11px] text-[#9d9280] truncate">{r.tips?.slice(-1)[0] ? `최근 가르침: ${r.tips.slice(-1)[0]}` : '가르친 내용 없음'}</p></div>
              <span className="font-pixel text-[8px] px-1.5 py-0.5 rounded text-white shrink-0" style={{ background: g.color }}>{g.label}</span>
              <div className="text-right shrink-0"><p className="text-[12.5px] font-bold text-[#241f17] tabular-nums">학습 v{r.version} · 규칙 {n}</p><p className="text-[11px] text-[#9d9280] tabular-nums">{r.best_score != null ? `최고 ${r.best_score.toLocaleString()}점` : '기록 없음'} · XP {xpOf(r)}</p></div>
            </li>) })}
        </ul>
      )}
    </div>
  )
}
