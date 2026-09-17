'use client'
// 라이브러리 — 미디어 라이브러리(승인된 에셋) 공개 목록·검색 + 게임 디자이너 모집.
// 디자이너: 일반 회원 누구나 접수 → 관리자 확인 후 직분이 '디자이너'로 → 내 정보의 라이브러리에서 작품 등록 → 관리자 승인 후 모두에게 공개.
// 회원이 디자이너의 에셋으로 게임을 만들면 크레딧을 쓰고, 그 크레딧은 100% 디자이너에게 쌓인다.
import { useEffect, useMemo, useState } from 'react'
import MiniClay from '@/components/MiniClay'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { titleFont } from '@/lib/fonts'

interface Asset { id: string; kind: string; name: string; title: string; description: string | null; tags: string[]; url: string; width: number | null; height: number | null; uses: number | null; created_at: string; designer_name: string | null }
const KINDS: [string, string][] = [['', '전체'], ['character', '캐릭터'], ['background', '배경'], ['tile', '타일·맵'], ['item', '아이템'], ['ui', 'UI'], ['effect', '이펙트'], ['sprite', '스프라이트'], ['audio', '오디오']]

export default function LibraryClient() {
  const router = useRouter()
  const [q, setQ] = useState(''); const [kind, setKind] = useState('')
  const [items, setItems] = useState<Asset[] | null>(null)
  const [me, setMe] = useState<{ role: string | null; application: { status: string } | null; loggedIn: boolean } | null>(null)
  const [apply, setApply] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', portfolio_url: '', message: '' })
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<Asset | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/library?q=${encodeURIComponent(q)}&kind=${kind}`).then((r) => r.json()).then((j) => setItems(j.items ?? [])).catch(() => setItems([]))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, kind])
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) { setMe({ role: null, application: null, loggedIn: false }); return }
      setForm((f) => ({ ...f, email: user.email ?? '', name: (user.user_metadata?.agent_name as string) ?? '' }))
      fetch('/api/library/apply').then((r) => r.json()).then((j) => setMe({ role: j.role ?? 'user', application: j.application ?? null, loggedIn: true })).catch(() => setMe({ role: 'user', application: null, loggedIn: true }))
    })
  }, [])

  const submit = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/library/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const j = await r.json()
      if (!r.ok) { setMsg(j.missing ? '접수 테이블이 아직 준비되지 않았어요 (관리자가 마이그레이션을 실행해야 해요)' : j.error ?? '접수 실패'); return }
      setMsg('접수됐어요! 관리자가 확인한 뒤 메일로 안내드려요.'); setMe((m) => (m ? { ...m, application: { status: 'pending' } } : m))
      setTimeout(() => setApply(false), 1500)
    } catch { setMsg('네트워크 오류') } finally { setBusy(false) }
  }
  const isDesigner = me?.role === 'designer' || me?.role === 'admin'
  const pending = me?.application?.status === 'pending'
  const count = useMemo(() => items?.length ?? 0, [items])

  return (
    <div className="max-w-6xl mx-auto px-5 pb-20">
      {/* 히어로 — 디자이너 모집 */}
      <section className="relative overflow-hidden rounded-[28px] mt-6 mb-10 px-6 py-10 md:px-12 md:py-14 text-white" style={{ background: 'radial-gradient(110% 90% at 15% 0%, #7c3aed 0%, #2e1065 45%, #0f0a2a 100%)' }}>
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.6) 1px, transparent 1.5px)', backgroundSize: '70px 70px' }} />
        <div className="relative z-10 md:flex md:items-center md:gap-10">
          <div className="flex-1 min-w-0" style={{ wordBreak: 'keep-all' }}>
            <p className="text-[11px] tracking-[0.32em] text-[#c4b5fd] font-bold mb-3">VIBREXCUP GALLERY</p>
            <h1 className={`${titleFont.className} text-[34px] md:text-[46px] leading-[1.15]`}>게임 디자이너를 찾습니다</h1>
            <p className="mt-4 text-[15px] md:text-[16px] text-white/85 leading-relaxed max-w-[560px]">
              캐릭터, 배경, 아이템, 효과음… 당신이 만든 디자인이 이곳의 게임 재료가 됩니다.
              회원이 프롬프트로 게임을 만들 때 AI 가 갤러리의 디자인을 골라 쓰고, 그때마다 디자이너에게 보상이 쌓입니다.
            </p>
            <div className="mt-5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur px-4 py-3.5 text-[13.5px] leading-relaxed">
              <p className="font-bold text-[#ffd166] mb-1">💰 보상 구조 — 크레딧 100% 디자이너에게</p>
              <p className="text-white/90">회원이 <b>당신의 디자인을 활용해 게임을 만들면 크레딧을 사용</b>하고, 그 <b>크레딧은 100% 디자이너에게 쌓입니다.</b> 플랫폼은 가져가지 않습니다. 쌓인 크레딧은 내 정보의 갤러리에서 확인할 수 있어요.</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {isDesigner ? (
                <Link href="/profile#library" className="inline-flex items-center h-12 px-6 rounded-full bg-[#ffd166] text-[#3a2500] text-[15px] font-extrabold shadow-[0_6px_0_#c9940c]">🎨 내 갤러리에 작품 올리기</Link>
              ) : pending ? (
                <span className="inline-flex items-center h-12 px-6 rounded-full bg-white/15 border border-white/25 text-[14px] font-bold">⏳ 접수 확인 중 — 승인되면 메일로 알려드려요</span>
              ) : (
                <button onClick={() => (me?.loggedIn ? setApply(true) : router.push('/login?redirect=/gallery'))} className="inline-flex items-center h-12 px-7 rounded-full bg-[#ffd166] text-[#3a2500] text-[15px] font-extrabold shadow-[0_6px_0_#c9940c] active:translate-y-[2px] active:shadow-[0_3px_0_#c9940c]">✍️ 디자이너 접수하기</button>
              )}
              <span className="text-[12.5px] text-white/70">일반 회원 누구나 접수할 수 있어요 · 관리자 확인 후 디자이너로 전환</span>
            </div>
          </div>
          {/* 점토 캐릭터들 — About 페이지의 점토이 친구들 */}
          <div className="hidden md:grid grid-cols-3 gap-4 w-[300px] shrink-0 mt-8 md:mt-0">
            {(['#5AB0F2', '#F2A65A', '#8BD17C', '#F27EA9', '#C9A0FF', '#FFD166'] as const).map((c, i) => (
              <div key={c} className="critter-bob w-full" style={{ animationDelay: `${i * 0.35}s` }}><MiniClay color={c} /></div>
            ))}
          </div>
        </div>
      </section>

      {/* 과정 */}
      <section className="grid sm:grid-cols-3 gap-3 mb-10">
        {[['1', '접수', '이름·이메일·포트폴리오 링크를 남기면 관리자가 확인해요.'], ['2', '승인 → 디자이너', '승인되면 회원 직분이 디자이너로 바뀌고, 내 정보에 갤러리 메뉴가 생겨요.'], ['3', '등록 → 공개 → 보상', '작품을 올리면 관리자 확인 후 모두에게 공개되고, 게임에 쓰일 때마다 크레딧이 100% 쌓여요.']].map(([n, t, d]) => (
          <div key={n} className="rounded-2xl bg-white border border-[#ebe4d6] p-5" style={{ wordBreak: 'keep-all' }}>
            <span className="inline-flex w-7 h-7 rounded-full bg-[#7c3aed] text-white text-[13px] font-extrabold items-center justify-center">{n}</span>
            <p className="mt-2.5 text-[15px] font-extrabold text-[#241f17]">{t}</p>
            <p className="mt-1 text-[13px] text-[#6b6152] leading-relaxed">{d}</p>
          </div>
        ))}
      </section>

      {/* 검색 + 목록 */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h2 className="text-[20px] font-extrabold text-[#241f17]">갤러리 <span className="text-[13px] font-semibold text-[#9d9280] ml-1">{count}개</span></h2>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색 — 캐릭터, 우주, 숲, 픽셀…" className="sm:ml-auto w-full sm:w-[320px] h-11 rounded-full border border-[#ddd3bf] bg-white px-4 text-[14px] outline-none focus:border-[#7c3aed]" />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4">
          {KINDS.map(([v, l]) => <button key={v} onClick={() => setKind(v)} className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold border transition-colors ${kind === v ? 'bg-[#241f17] text-white border-[#241f17]' : 'bg-white text-[#4a4337] border-[#ddd3bf] hover:border-[#241f17]'}`}>{l}</button>)}
        </div>
        {items === null ? <p className="py-16 text-center text-[#9d9280] text-[14px]">불러오는 중…</p>
          : items.length === 0 ? <p className="py-16 text-center text-[#9d9280] text-[14px]">{q ? '검색에 없습니다.' : '아직 등록된 디자인이 없어요.'}</p>
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {items.map((a) => (
                <button key={a.id} onClick={() => setPreview(a)} className="group text-left rounded-2xl overflow-hidden bg-white border border-[#ebe4d6] hover:border-[#7c3aed] hover:shadow-[0_10px_30px_-12px_rgba(124,58,237,.35)] transition-all">
                  <div className="aspect-square bg-[repeating-conic-gradient(#f3f0e8_0_25%,#fff_0_50%)] bg-[length:16px_16px] flex items-center justify-center overflow-hidden">
                    {a.kind === 'audio' ? <span className="text-4xl">🎵</span> : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.title} loading="lazy" className="w-full h-full object-contain group-hover:scale-[1.04] transition-transform duration-500" />
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[13px] font-bold text-[#241f17] truncate">{a.title}</p>
                    <p className="text-[11px] text-[#9d9280] truncate">{KINDS.find((k) => k[0] === a.kind)?.[1] ?? a.kind}{a.width ? ` · ${a.width}×${a.height}` : ''}{a.designer_name ? ` · by ${a.designer_name}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
      </section>

      {/* 미리보기 */}
      {preview && (
        <div className="fixed inset-0 z-[90] bg-[#241f17]/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[repeating-conic-gradient(#f3f0e8_0_25%,#fff_0_50%)] bg-[length:20px_20px] flex items-center justify-center max-h-[60vh]">
              {preview.kind === 'audio' ? <audio src={preview.url} controls className="my-10 w-[90%]" /> : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.title} className="max-h-[60vh] w-auto object-contain" />
              )}
            </div>
            <div className="p-4">
              <p className="text-[16px] font-extrabold text-[#241f17]">{preview.title}</p>
              <p className="text-[12px] text-[#9d9280] mt-0.5">코드 키 <code className="bg-[#f1ece2] px-1.5 py-0.5 rounded">{preview.name}</code>{preview.width ? ` · ${preview.width}×${preview.height}` : ''}{preview.designer_name ? ` · 디자이너 ${preview.designer_name}` : ''}</p>
              {preview.description && <p className="text-[13px] text-[#4a4337] mt-2 leading-relaxed">{preview.description}</p>}
              <p className="text-[12px] text-[#6b6152] mt-3 bg-[#faf8f3] border border-[#ebe4d6] rounded-lg px-3 py-2">스튜디오에서 프롬프트에 이 디자인 이름을 적거나 미디어 선택기에서 고르면 게임에 들어가요. 사용한 크레딧은 100% 디자이너에게 쌓입니다.</p>
              <div className="mt-3 flex justify-end gap-2"><Link href="/studio" className="h-9 px-4 rounded-lg bg-[#7c3aed] text-white text-[13px] font-semibold inline-flex items-center">스튜디오에서 쓰기</Link><button onClick={() => setPreview(null)} className="h-9 px-4 rounded-lg border border-[#ddd3bf] text-[13px] font-medium">닫기</button></div>
            </div>
          </div>
        </div>
      )}

      {/* 접수 모달 */}
      {apply && (
        <div className="fixed inset-0 z-[90] bg-[#241f17]/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setApply(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[20px] font-extrabold text-[#241f17]">디자이너 접수</h3>
            <p className="text-[13px] text-[#6b6152] mt-1 leading-relaxed" style={{ wordBreak: 'keep-all' }}>관리자가 확인한 뒤 이메일로 안내드려요. 승인되면 내 정보에 갤러리가 생기고 작품을 올릴 수 있어요. 회원이 작품을 활용해 쓴 크레딧은 100% 당신에게 쌓입니다.</p>
            <div className="mt-4 space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="이름 또는 활동명" className="w-full h-11 rounded-xl border border-[#ddd3bf] px-4 text-[14px] outline-none focus:border-[#7c3aed]" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="연락받을 이메일" type="email" className="w-full h-11 rounded-xl border border-[#ddd3bf] px-4 text-[14px] outline-none focus:border-[#7c3aed]" />
              <input value={form.portfolio_url} onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })} placeholder="포트폴리오 링크 (선택)" className="w-full h-11 rounded-xl border border-[#ddd3bf] px-4 text-[14px] outline-none focus:border-[#7c3aed]" />
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="어떤 디자인을 만드시나요? (선택)" rows={3} className="w-full rounded-xl border border-[#ddd3bf] px-4 py-3 text-[14px] outline-none focus:border-[#7c3aed]" />
            </div>
            {msg && <p className="mt-3 text-[13px] font-semibold text-[#7c3aed]">{msg}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={submit} disabled={busy || !form.name.trim() || !form.email.trim()} className="flex-1 h-11 rounded-xl bg-[#7c3aed] text-white text-[14px] font-bold disabled:opacity-50">{busy ? '접수 중…' : '접수하기'}</button>
              <button onClick={() => setApply(false)} className="h-11 px-5 rounded-xl border border-[#ddd3bf] text-[14px] font-medium">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
