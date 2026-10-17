'use client'
// 스튜디오 › 디자인 AI — 승인된 디자이너의 작업 공간.
// 접수(관리자 승인 직분 designer) 전에는 접수 화면, 승인되면 내 드라이브 · AI 이미지 · 3D 모델 · 갤러리 검색 · 공개 작품.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AiModeToggle from '@/components/studio/AiModeToggle'
import { PromptCreditBadge } from '@/components/CurrencyBadge'
import MascotLoader from '@/components/MascotLoader'
import Drive from './Drive'
import ImageGen from './ImageGen'
import Model3D from './Model3D'
import GallerySearch from './GallerySearch'
import MyWorks from './MyWorks'
import ParticleField, { fieldSay } from './ParticleField'
import Decode from './Decode'

const WORD: Record<string, string> = { drive: 'DRIVE', search: 'GALLERY', image: 'IMAGINE', model3d: 'FORM', works: 'SIGNAL' }
import { ui, type Section, type Source3D } from './shared'

const NAV: [Section, string, string, string][] = [
  ['drive', '', '내 드라이브', '내가 저장한 이미지·3D·오디오'],
  ['search', '', '전체 갤러리', '공개된 모든 디자인 보기·검색'],
  ['image', '', 'AI 이미지', '프롬프트로 캐릭터·배경·아이템'],
  ['model3d', '', '3D 모델', '이미지·글을 3D(GLB)로'],
  ['works', '', '공개 작품', '승인 상태 · 크레딧'],
]

export default function DesignerStudio() {
  const router = useRouter()
  const [me, setMe] = useState<{ role: string; application: { status: string } | null } | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [section, setSection] = useState<Section>('drive')
  const [refresh, setRefresh] = useState(0)
  const [source3d, setSource3d] = useState<Source3D | null>(null)
  const [form, setForm] = useState({ name: '', email: '', portfolio_url: '', message: '' })
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/studio/design'); return }
      setForm((f) => ({ ...f, email: user.email ?? '', name: (user.user_metadata?.agent_name as string) ?? '' }))
      const j = await fetch('/api/library/apply').then((r) => r.json()).catch(() => ({}))
      setMe({ role: j.role ?? 'user', application: j.application ?? null })
      const { data: bal } = await sb.rpc('grant_signup_bonus' as never)
      if (typeof bal === 'number') setBalance(bal)
    })
  }, [router])
  // 섹션은 주소 #hash 로 기억
  useEffect(() => {
    const sync = () => { const h = location.hash.slice(1) as Section; if (NAV.some(([k]) => k === h)) setSection(h) }
    const t = setTimeout(sync, 0)
    window.addEventListener('hashchange', sync)
    return () => { clearTimeout(t); window.removeEventListener('hashchange', sync) }
  }, [])
  const go = (s: Section) => { setSection(s); history.replaceState(null, '', '#' + s) }
  // 메뉴를 옮기면 빛 입자가 그 영역의 이름으로 모인다
  useEffect(() => { const t = setTimeout(() => fieldSay({ word: WORD[section] }), 350); return () => clearTimeout(t) }, [section])
  const make3D = (s: Source3D) => { setSource3d({ ...s }); go('model3d') }
  const saved = () => setRefresh((n) => n + 1)

  const apply = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/library/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const j = await r.json()
      if (!r.ok) { setMsg(j.error ?? '접수 실패'); return }
      setMe((m) => (m ? { ...m, application: { status: 'pending' } } : m))
    } catch { setMsg('네트워크 오류') } finally { setBusy(false) }
  }

  if (!me) return <MascotLoader />
  const isDesigner = me.role === 'designer' || me.role === 'admin'
  const status = me.application?.status

  return (
    <div className="relative min-h-[100svh] bg-[radial-gradient(1200px_700px_at_80%_10%,#e9f3ff_0%,transparent_60%),radial-gradient(900px_600px_at_10%_90%,#f3ecff_0%,transparent_60%),radial-gradient(700px_500px_at_95%_95%,#e3fbf7_0%,transparent_60%),linear-gradient(180deg,#fbfcff,#f4f6ff)]">
      {/* 빛의 입자 — 작은 빛이 모여 모양을 이루고 흩어진다 */}
      <ParticleField />
      {/* 상단 바 */}
      <div className="app-top-pad sticky top-0 z-30 flex items-center gap-3 border-b border-white/70 bg-white/45 backdrop-blur-2xl shadow-[0_1px_0_rgba(99,102,241,0.08),0_8px_30px_-18px_rgba(79,70,229,0.35)] px-4 h-14 box-content">
        <Link href="/studio" className="font-pixel text-[11px] text-[#4b5277] hover:text-[#4f46e5] tracking-widest transition-colors shrink-0">‹ STUDIO</Link>
        <div className="flex-1 flex justify-center min-w-0 overflow-x-auto scrollbar-hide"><AiModeToggle /></div>
        <Link href="/credits" className="hover:opacity-80 transition-opacity shrink-0" title="프롬코인 충전"><PromptCreditBadge amount={balance} size="sm" compact /></Link>
      </div>

      {!isDesigner ? (
        /* ── 접수 / 승인 대기 ── */
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-10 md:py-16">
          <div className="text-center" style={{ wordBreak: 'keep-all' }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ec4899]/10 to-[#f59e0b]/10 border border-[#f9c4d8] px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.2em] text-[#be185d]">DESIGN AI</span>
            <h1 className="mt-4 text-[28px] md:text-[38px] font-black text-[#1f2340] leading-tight">디자이너를 위한 작업 공간</h1>
            <p className="mt-3 text-[14.5px] text-[#4b5277] leading-relaxed">AI 로 캐릭터·배경·아이템 이미지를 그리고, 3D 모델로 만들고, 내 드라이브에 모아 갤러리에 공개하세요.<br className="hidden md:block" />회원이 내 디자인으로 게임을 만들면 그 크레딧은 <b className="text-[#1f2340]">100% 디자이너에게</b> 쌓여요.</p>
          </div>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {NAV.slice(0, 4).map(([k, i, t, d]) => <div key={k} className={`${ui.card} p-4`}><p className="text-[24px]">{i}</p><p className="mt-1 text-[14px] font-extrabold text-[#1f2340]">{t}</p><p className="text-[12px] text-[#8a90b2] mt-0.5">{d}</p></div>)}
          </div>
          <div className={`${ui.card} mt-6 p-5 md:p-7`}>
            {status === 'pending' ? (
              <div className="text-center py-6">
                <span className="vx-orb" aria-hidden />
                <p className="mt-2 text-[17px] font-extrabold text-[#1f2340]">접수 확인 중이에요</p>
                <p className="mt-1 text-[13px] text-[#4b5277]">관리자가 승인하면 이 화면이 바로 디자이너 작업 공간으로 바뀌어요. 메일로도 알려드려요.</p>
              </div>
            ) : (
              <>
                <h2 className="text-[18px] font-extrabold text-[#1f2340]">디자이너 접수</h2>
                <p className="text-[12.5px] text-[#4b5277] mt-1">{status === 'rejected' ? '지난 접수는 반려됐어요. 포트폴리오를 보강해 다시 접수할 수 있어요.' : '일반 회원 누구나 접수할 수 있어요. 관리자가 확인한 뒤 승인하면 디자인 AI 가 열려요.'}</p>
                <div className="mt-4 grid sm:grid-cols-2 gap-2.5">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="이름 또는 활동명" className={ui.input} />
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="연락받을 이메일" type="email" className={ui.input} />
                  <input value={form.portfolio_url} onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })} placeholder="포트폴리오 링크 (선택)" className={`${ui.input} sm:col-span-2`} />
                  <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="어떤 디자인을 만드시나요? (선택)" rows={3} className={`${ui.input} h-auto py-3 sm:col-span-2 resize-none`} />
                </div>
                {msg && <p className="mt-3 text-[13px] font-semibold text-[#dc2626]">{msg}</p>}
                <button onClick={apply} disabled={busy || !form.name.trim() || !form.email.trim()} className={`${ui.primary} mt-4 w-full h-12 text-[14px]`}>{busy ? '접수 중…' : '디자이너 접수하기'}</button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── 작업 공간 ── */
        <div className="relative z-10 flex flex-col md:flex-row">
          <aside className="md:w-[220px] shrink-0 md:min-h-[calc(100svh-3.5rem)] md:border-r border-white/70 bg-white/35 backdrop-blur-2xl md:sticky md:top-14 md:self-start">
            <p className="hidden md:block px-5 pt-5 pb-1 text-[10px] font-extrabold tracking-[0.3em] bg-gradient-to-r from-[#4f46e5] via-[#7c3aed] to-[#06b6d4] bg-clip-text text-transparent">VIBREX · DESIGN LAB</p>
            <nav className="flex md:flex-col gap-1 p-2 md:p-3 overflow-x-auto scrollbar-hide">
              {NAV.map(([k, i, t, d]) => (
                <button key={k} onClick={() => go(k)} className={`shrink-0 flex items-center gap-2.5 rounded-xl px-3 h-10 md:h-auto md:py-2.5 text-left transition-all ${section === k ? 'bg-gradient-to-r from-[#4f46e5] to-[#06b6d4] text-white shadow-[0_8px_24px_-8px_rgba(79,70,229,0.7)]' : 'text-[#3b4166] hover:bg-white/60'}`}>
                  <span className="min-w-0"><Decode text={t} className="block text-[13px] font-bold whitespace-nowrap" /><span className={`hidden md:block text-[10.5px] truncate ${section === k ? 'text-white/75' : 'text-[#8a90b2]'}`}>{d}</span></span>
                </button>
              ))}
            </nav>
          </aside>
          <main className="flex-1 min-w-0 p-4 md:p-6">
            <header className="mb-4 flex items-end gap-3">
              <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-[#1f2340]"><Decode key={section} text={NAV.find(([k]) => k === section)?.[2] ?? ''} replayOnHover /></h1>
              <span className="vx-glyph mb-1.5 text-[10px] font-bold bg-gradient-to-r from-[#4f46e5] to-[#06b6d4] bg-clip-text text-transparent">{'// ' + WORD[section]}</span>
            </header>
            {section === 'drive' && <Drive refresh={refresh} onMake3D={make3D} />}
            {section === 'image' && <ImageGen onSaved={saved} onMake3D={make3D} />}
            {section === 'model3d' && <Model3D source={source3d} onSaved={saved} />}
            {section === 'search' && <GallerySearch onMake3D={make3D} />}
            {section === 'works' && <MyWorks refresh={refresh} />}
          </main>
        </div>
      )}
    </div>
  )
}
