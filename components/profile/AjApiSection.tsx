'use client'
// 내 AJ 를 밖에서 쓰기 — 크롬 확장 키(무료) · 개발자 API 키(프롬코인 과금) 발급/폐기 + 사용법
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface KeyRow { id: string; kind: 'chrome' | 'api'; name: string; prefix: string; scopes: string[]; calls_total: number; calls_today: number; calls_day: string | null; last_used_at: string | null; revoked_at: string | null; created_at: string }
interface Settings { chromeDailyQuota: number; apiDailyQuota: number; perMinute: number; maxKeysPerUser: number; creditsPerChat: number; creditsPerTts: number; minBalanceToIssue: number }
interface State { ready: boolean; keys: KeyRow[]; settings: Settings; balance: number }

const SITE = 'https://vibrexcup.com'

export default function AjApiSection() {
  const [st, setSt] = useState<State | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [fresh, setFresh] = useState<{ kind: 'chrome' | 'api'; key: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const load = useCallback(async () => { try { const r = await fetch('/api/aj-keys'); if (r.ok) setSt(await r.json()) } catch { /* ignore */ } }, [])
  useEffect(() => { const t = setTimeout(() => { void load() }, 0); return () => clearTimeout(t) }, [load])

  const issue = async (kind: 'chrome' | 'api') => {
    setBusy(kind); setErr(null); setFresh(null); setCopied(false)
    try {
      const r = await fetch('/api/aj-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? String(r.status))
      setFresh({ kind, key: j.key }); await load()
    } catch (e) { setErr(e instanceof Error ? e.message : '발급 실패') } finally { setBusy(null) }
  }
  const revoke = async (id: string) => {
    setBusy(id); setErr(null)
    try { const r = await fetch('/api/aj-keys', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (!r.ok) throw new Error('폐기 실패'); await load() }
    catch (e) { setErr(e instanceof Error ? e.message : '폐기 실패') } finally { setBusy(null) }
  }
  const copy = async () => { if (!fresh) return; try { await navigator.clipboard.writeText(fresh.key); setCopied(true) } catch { /* ignore */ } }

  const s = st?.settings
  const active = (st?.keys ?? []).filter(k => !k.revoked_at)
  const chromeKey = active.find(k => k.kind === 'chrome')
  const apiKeys = active.filter(k => k.kind === 'api')
  const curl = `curl -N ${SITE}/api/v1/aj/chat \\
  -H "Authorization: Bearer vxaj_…" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"오늘 뭐 하고 놀까?","stream":true}'`
  const js = `const r = await fetch('${SITE}/api/v1/aj/chat', {
  method: 'POST',
  headers: { Authorization: 'Bearer vxaj_…', 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: '이 페이지 요약해줘', context: { title: document.title, url: location.href } })
})
const { reply } = await r.json()`

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#ebe4d6] bg-white p-5 md:p-6">
        <p className="font-pixel text-[10px] tracking-[0.3em] text-[#2563eb]">MY AJ · EVERYWHERE</p>
        <h3 className="mt-1 text-[20px] font-extrabold tracking-tight text-[#241f17]">내 AJ를 밖에서도 쓰기</h3>
        <p className="mt-1.5 text-[13px] text-[#6b6152] max-w-2xl">내 AJ(이름·성격·말투·내 게임 지식)를 크롬 확장에서 대화 상대로 쓰거나, 개발자 API로 다른 앱에 붙일 수 있어요. 크롬 확장은 무료, API는 프롬코인으로 호출당 과금됩니다. 자세한 가이드는 <Link href="/dev" className="text-[#2563eb] font-semibold underline">DEV 페이지</Link>에 있어요.</p>
        {st && !st.ready && <p className="mt-3 text-[12px] text-[#e11d48]">DB 마이그레이션(2026-09-10-aj-api-keys.sql)이 아직 실행되지 않았어요.</p>}
        {err && <p className="mt-3 text-[12.5px] text-[#e11d48] bg-[#e11d48]/5 rounded-lg px-3 py-2">{err}{err.includes('프롬코인') && <> · <Link href="/credits" className="underline font-semibold">충전하기</Link></>}</p>}

        {fresh && (
          <div className="mt-4 rounded-xl border border-[#2563eb]/40 bg-[#2563eb]/[0.05] p-4">
            <p className="text-[12.5px] font-bold text-[#241f17]">{fresh.kind === 'chrome' ? '크롬 확장 키' : '개발자 API 키'}가 발급됐어요. <span className="text-[#e11d48]">지금만 볼 수 있어요</span> — 복사해서 안전한 곳에 두세요.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate rounded-lg bg-white border border-[#ddd3bf] px-3 py-2 text-[12.5px] text-[#241f17]">{fresh.key}</code>
              <button onClick={copy} className="h-9 px-3 rounded-lg bg-[#241f17] text-white text-[12px] font-bold shrink-0">{copied ? '복사됨 ✓' : '복사'}</button>
            </div>
            {fresh.kind === 'chrome' && <p className="mt-2 text-[12px] text-[#6b6152]">확장 팝업의 “키 붙여넣기”에 넣으면 바로 연결돼요.</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 크롬 확장 — 무료 */}
        <section className="rounded-2xl border border-[#ebe4d6] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-pixel text-[10px] tracking-widest text-[#059669]">CHROME EXTENSION · FREE</p>
              <h4 className="mt-1 text-[16px] font-bold text-[#241f17]">크롬 확장에서 내 AJ와 대화</h4>
              <p className="mt-1 text-[12.5px] text-[#6b6152]">어느 사이트에서든 팝업을 열면 AJ가 지금 보는 페이지를 읽고 대화해요. 하루 {s?.chromeDailyQuota ?? 200}회 무료.</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#059669]/10 text-[#059669] text-[11px] font-bold px-2.5 py-1">무료</span>
          </div>
          <ol className="mt-4 space-y-1.5 text-[12.5px] text-[#4a4337] list-decimal pl-5">
            <li><a href="/downloads/vibrexcup-aj-chrome.zip" className="text-[#2563eb] font-semibold underline">확장 파일(zip) 내려받기</a> → 압축 해제</li>
            <li>크롬 주소창에 <code className="bg-[#f5efe3] px-1 rounded">chrome://extensions</code> → 우상단 <b>개발자 모드</b> 켜기 → <b>압축해제된 확장 프로그램을 로드</b> → 폴더 선택</li>
            <li>아래 버튼으로 키를 발급해 확장 팝업에 붙여넣기</li>
          </ol>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {chromeKey ? (
              <>
                <span className="text-[12px] text-[#4a4337]">연결된 키 <code className="bg-[#f5efe3] px-1.5 py-0.5 rounded">{chromeKey.prefix}…</code> · 오늘 {chromeKey.calls_day === new Date().toISOString().slice(0, 10) ? chromeKey.calls_today : 0}/{s?.chromeDailyQuota} · 누적 {chromeKey.calls_total}</span>
                <button onClick={() => revoke(chromeKey.id)} disabled={!!busy} className="h-8 px-3 rounded-lg border border-[#ddd3bf] text-[12px] font-semibold text-[#6b6152] hover:border-[#e11d48] hover:text-[#e11d48] disabled:opacity-50">키 폐기</button>
              </>
            ) : (
              <button onClick={() => issue('chrome')} disabled={!!busy || !st?.ready} className="h-10 px-4 rounded-xl bg-[#059669] text-white text-[13px] font-bold hover:bg-[#047857] disabled:opacity-50">{busy === 'chrome' ? '발급 중…' : '크롬 확장 키 발급 (무료)'}</button>
            )}
          </div>
        </section>

        {/* 개발자 API — 유료 */}
        <section className="rounded-2xl border border-[#ebe4d6] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-pixel text-[10px] tracking-widest text-[#7c3aed]">DEVELOPER API · PAY PER CALL</p>
              <h4 className="mt-1 text-[16px] font-bold text-[#241f17]">개발자 API로 어디든 붙이기</h4>
              <p className="mt-1 text-[12.5px] text-[#6b6152]">웹·앱·봇에서 REST로 호출. 채팅 {s?.creditsPerChat ?? 1}코인 · 목소리(TTS) {s?.creditsPerTts ?? 2}코인 / 호출. 분당 {s?.perMinute ?? 30}회, 일 {s?.apiDailyQuota ?? 5000}회.</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#7c3aed]/10 text-[#7c3aed] text-[11px] font-bold px-2.5 py-1">프롬코인 {st?.balance ?? 0}</span>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button onClick={() => issue('api')} disabled={!!busy || !st?.ready} className="h-10 px-4 rounded-xl bg-[#7c3aed] text-white text-[13px] font-bold hover:bg-[#6d28d9] disabled:opacity-50">{busy === 'api' ? '발급 중…' : 'API 키 발급'}</button>
            {(st?.balance ?? 0) < (s?.minBalanceToIssue ?? 1) && <Link href="/credits" className="h-10 px-4 inline-flex items-center rounded-xl border border-[#ddd3bf] text-[13px] font-semibold text-[#241f17] hover:border-[#2563eb] hover:text-[#2563eb]">프롬코인 충전 →</Link>}
          </div>
          {apiKeys.length > 0 && (
            <ul className="mt-4 divide-y divide-[#f0e9dc]">
              {apiKeys.map(k => (
                <li key={k.id} className="py-2 flex items-center gap-3">
                  <code className="text-[12px] bg-[#f5efe3] px-1.5 py-0.5 rounded">{k.prefix}…</code>
                  <span className="flex-1 min-w-0 text-[12px] text-[#6b6152] truncate">{k.name} · 오늘 {k.calls_day === new Date().toISOString().slice(0, 10) ? k.calls_today : 0} · 누적 {k.calls_total}{k.last_used_at ? ` · ${new Date(k.last_used_at).toLocaleDateString()}` : ''}</span>
                  <button onClick={() => revoke(k.id)} disabled={!!busy} className="text-[11.5px] font-semibold text-[#9d9280] hover:text-[#e11d48] disabled:opacity-50">폐기</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 사용법 */}
      <section className="rounded-2xl border border-[#ebe4d6] bg-white p-5">
        <h4 className="font-pixel text-[11px] text-[#6b6152] tracking-widest mb-3">API REFERENCE</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12.5px]">
          {[
            ['GET /api/v1/aj/me', 'AJ 프로필 — 이름·성격·아바타·목소리·내 게임·학습 통계·할당량', 'profile'],
            ['POST /api/v1/aj/chat', '{ message, history?, context?{title,url,text,genre}, stream? } → 답변. stream:true 면 텍스트 스트리밍', 'chat'],
            ['POST /api/v1/aj/tts', '{ text } → mp3 (AJ 목소리). 개발자 키 전용', 'tts'],
          ].map(([ep, d, sc]) => (
            <div key={ep} className="rounded-xl border border-[#ebe4d6] bg-[#faf8f3] p-3">
              <code className="text-[12px] font-bold text-[#241f17]">{ep}</code>
              <p className="mt-1 text-[#4a4337]">{d}</p>
              <p className="mt-1 text-[11px] text-[#9d9280]">scope: {sc} · Authorization: Bearer 키 · CORS 허용</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <pre className="rounded-xl bg-[#171b26] text-[#ece7dc] text-[11.5px] leading-relaxed p-4 overflow-x-auto"><code>{curl}</code></pre>
          <pre className="rounded-xl bg-[#171b26] text-[#ece7dc] text-[11.5px] leading-relaxed p-4 overflow-x-auto"><code>{js}</code></pre>
        </div>
        <p className="mt-3 text-[11.5px] text-[#9d9280]">응답 헤더 <code>X-AJ-Charged</code>(차감 코인) · <code>X-AJ-Quota</code>(오늘/일한도). 잔액 부족 402, 한도 초과 429. 크롬 확장 키는 확장 밖에서 호출하면 403.</p>
      </section>
    </div>
  )
}
