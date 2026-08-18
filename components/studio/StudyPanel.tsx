'use client'
// 학습 노트 — 🧩 코드 보기 / 📖 시나리오 보기. 아이가 "프롬프트 → 시나리오 → 코드"의 흐름을 따라 배울 수 있게.
import { useEffect, useState } from 'react'
import type { StudyNotes } from '@/app/api/studio/explain/route'

type Tab = 'code' | 'scenario' | 'source'

export default function StudyPanel({ versionId, html, initialTab = 'code', onClose, onTryPrompt }: {
  versionId: string
  html: string
  initialTab?: Tab
  onClose: () => void
  onTryPrompt?: (prompt: string) => void
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [notes, setNotes] = useState<StudyNotes | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/studio/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionId }) })
      .then(async (r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then((j) => { if (alive) setNotes(j.notes) })
      .catch(() => { if (alive) setErr('학습 노트를 만들지 못했어요. 잠시 후 다시 열어 주세요.') })
    return () => { alive = false }
  }, [versionId])

  const lines = html.split('\n')
  const tabBtn = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)} className={`font-pixel text-[11px] tracking-widest px-4 py-2 rounded-full transition-colors ${tab === t ? 'bg-[#2563eb] text-white' : 'text-[#6b6152] hover:bg-[#241f17]/5'}`}>{label}</button>
  )

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 md:p-8" onClick={onClose}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-4xl h-[88vh] bg-[#fcfaf5] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#ebe4d6] bg-white/70">
          <span className="font-pixel text-[11px] text-[#2563eb] tracking-widest mr-2">STUDY NOTE</span>
          {tabBtn('scenario', '📖 시나리오')}
          {tabBtn('code', '🧩 코드는 어떻게?')}
          {tabBtn('source', '</> 전체 소스')}
          <div className="flex-1" />
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-full hover:bg-[#241f17]/5 text-[#6b6152]">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-7">
          {tab !== 'source' && !notes && !err && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-[#857a68]">
              <div className="w-8 h-8 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">선생님 AJ가 이 게임을 읽고 설명을 준비하고 있어요…</p>
            </div>
          )}
          {tab !== 'source' && err && <p className="text-sm text-red-500">{err}</p>}

          {tab === 'scenario' && notes && (
            <div className="space-y-4">
              <p className="text-[13px] text-[#857a68]">프롬프트(내가 쓴 말)가 어떻게 게임의 규칙과 장면으로 바뀌었는지 볼까요?</p>
              <ol className="space-y-3">
                {notes.scenario.map((sct, i) => (
                  <li key={i} className="flex gap-3 rounded-2xl bg-white border border-[#ebe4d6] p-4">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-[#2563eb] to-[#06b6d4] text-white font-pixel text-[11px] flex items-center justify-center">{i + 1}</span>
                    <div><p className="font-bold text-[#241f17] text-[15px]">{sct.title}</p><p className="text-[13.5px] text-[#4a4337] leading-relaxed mt-1 whitespace-pre-wrap">{sct.body}</p></div>
                  </li>
                ))}
              </ol>
              {notes.challenge.length > 0 && (
                <div className="rounded-2xl border border-dashed border-[#2563eb]/40 bg-[#2563eb]/5 p-4">
                  <p className="font-pixel text-[10px] text-[#2563eb] tracking-widest mb-2">NEXT CHALLENGE · 다음엔 이렇게 말해 보세요</p>
                  <div className="flex flex-wrap gap-2">
                    {notes.challenge.map((c) => (
                      <button key={c} onClick={() => { onTryPrompt?.(c); onClose() }} className="rounded-full bg-white border border-[#ddd3bf] px-3 py-1.5 text-[12px] text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb]">✨ {c}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'code' && notes && (
            <div className="space-y-4">
              <p className="text-[13px] text-[#857a68]">게임 코드는 이런 순서로 짜여 있어요. 어려우면 초록 상자(코드)는 건너뛰고 설명만 읽어도 좋아요.</p>
              {notes.code.map((c, i) => (
                <div key={i} className="rounded-2xl bg-white border border-[#ebe4d6] p-4">
                  <p className="font-bold text-[#241f17] text-[15px]"><span className="text-[#2563eb] font-pixel text-[10px] mr-2">STEP {i + 1}</span>{c.title}</p>
                  <p className="text-[13.5px] text-[#4a4337] leading-relaxed mt-1 whitespace-pre-wrap">{c.body}</p>
                  {c.snippet && <pre className="mt-3 rounded-xl bg-[#0f1a14] text-[#c8f5d0] text-[11.5px] leading-relaxed p-3 overflow-x-auto"><code>{c.snippet}</code></pre>}
                </div>
              ))}
              {notes.glossary.length > 0 && (
                <div className="rounded-2xl bg-white border border-[#ebe4d6] p-4">
                  <p className="font-pixel text-[10px] text-[#9d9280] tracking-widest mb-2">단어 사전</p>
                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                    {notes.glossary.map((g) => (<div key={g.term} className="text-[13px]"><dt className="font-semibold text-[#241f17] inline">{g.term}</dt><dd className="inline text-[#6b6152]"> — {g.meaning}</dd></div>))}
                  </dl>
                </div>
              )}
            </div>
          )}

          {tab === 'source' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] text-[#857a68]">{lines.length.toLocaleString()}줄 · {(html.length / 1024).toFixed(1)}KB — 이 파일 하나가 게임 전체예요.</p>
                <button onClick={async () => { try { await navigator.clipboard.writeText(html); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }} className="font-pixel text-[10px] border border-[#ddd3bf] px-3 py-1.5 rounded-full text-[#6b6152] hover:border-[#2563eb] hover:text-[#2563eb]">{copied ? '복사됨!' : '전체 복사'}</button>
              </div>
              <pre className="rounded-xl bg-[#0f1a14] text-[#d7e6da] text-[11.5px] leading-relaxed p-4 overflow-auto max-h-[68vh]">
                <code>{lines.map((l, i) => (<span key={i} className="block"><span className="inline-block w-10 text-right pr-3 text-[#4b6a55] select-none">{i + 1}</span>{l}</span>))}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
