'use client'
// 스튜디오 › 디자인 AI — 승인된 디자이너의 작업 공간.
// 접수(관리자 승인 직분 designer) 전에는 접수 화면, 승인되면 내 드라이브 · AI 이미지 · 3D 모델 · 갤러리 검색 · 공개 작품.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AiModeToggle from '@/components/studio/AiModeToggle'
import { PromptCreditBadge } from '@/components/CurrencyBadge'
import CubeLoader from './CubeLoader'
import Drive from './Drive'
import ImageGen from './ImageGen'
import Model3D from './Model3D'
import GallerySearch from './GallerySearch'
import MyWorks from './MyWorks'
import ParticleField, { fieldSay } from './ParticleField'
import Decode from './Decode'

// 레일 아이콘 — 얇은 선의 기하 도형 (각진 형태)
const ICON: Record<string, React.ReactNode> = {
  drive: <><rect x="4" y="6" width="16" height="12" /><path d="M4 10h16" /></>,
  search: <><rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></>,
  image: <><rect x="4" y="4" width="16" height="16" /><path d="M4 16l5-5 4 4 2-2 5 5" /><rect x="14" y="7" width="3" height="3" /></>,
  model3d: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></>,
  works: <><rect x="5" y="5" width="14" height="14" /><path d="M9 12l2 2 4-4" /></>,
}
const WORD: Record<string, string> = { drive: 'DRIVE', search: 'GALLERY', image: 'IMAGINE', model3d: 'FORM', works: 'SIGNAL' }
import { ui, type Section, type Source3D } from './shared'

const NAV: [Section, string, string, string][] = [
  ['drive', '⌖', '내 드라이브', '내가 저장한 이미지·3D·오디오'],
  ['search', '⟁', '전체 갤러리', '공개된 모든 디자인 보기·검색'],
  ['image', '◬', 'AI 이미지', '프롬프트로 캐릭터·배경·아이템'],
  ['model3d', '⧖', '3D 모델', '이미지·글을 3D(GLB)로'],
  ['works', '⍜', '공개 작품', '승인 상태 · 크레딧'],
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

  if (!me) return <div className="min-h-[100svh] flex items-center justify-center bg-white"><CubeLoader size={84} label="디자인 AI 여는 중" /></div>
  const isDesigner = me.role === 'designer' || me.role === 'admin'
  const status = me.application?.status

  return (
    <div className="relative min-h-[100svh] bg-white">
      {/* 빛의 입자 — 작은 빛이 모여 모양을 이루고 흩어진다 */}
      <ParticleField />
      {/* 상단 바 */}
      <div className="app-top-pad sticky top-0 z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/70 bg-white/45 backdrop-blur-2xl shadow-[0_1px_0_rgba(37,99,235,0.08),0_8px_30px_-18px_rgba(37,99,235,0.35)] px-4 h-11 box-content">
        <nav className="flex items-center gap-1.5 min-w-0 text-[12px]">
          <Link href="/studio" className="font-pixel text-[11px] text-[#4b5563] hover:text-[#2563eb] tracking-widest transition-colors">‹ STUDIO</Link>
          {isDesigner && <><span className="text-[#cbd2de]">/</span><span className="font-bold text-[#1f2937] truncate">{NAV.find(([k]) => k === section)?.[2] ?? ''}</span></>}
        </nav>
        <div className="flex justify-center min-w-0"><AiModeToggle /></div>
        <Link href="/credits" className="justify-self-end hover:opacity-80 transition-opacity shrink-0" title="프롬코인 충전"><PromptCreditBadge amount={balance} size="sm" compact /></Link>
      </div>

      {!isDesigner ? (
        /* ── 접수 / 승인 대기 ── */
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-10 md:py-16">
          <div className="text-center" style={{ wordBreak: 'keep-all' }}>
            <span className="inline-flex items-center gap-2 rounded-[4px] bg-gradient-to-r from-[#ec4899]/10 to-[#f59e0b]/10 border border-[#f9c4d8] px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.2em] text-[#be185d]">DESIGN AI</span>
            <h1 className="mt-4 text-[28px] md:text-[38px] font-black text-[#1f2937] leading-tight">디자이너를 위한 작업 공간</h1>
            <p className="mt-3 text-[14.5px] text-[#4b5563] leading-relaxed">AI 로 캐릭터·배경·아이템 이미지를 그리고, 3D 모델로 만들고, 내 드라이브에 모아 갤러리에 공개하세요.<br className="hidden md:block" />회원이 내 디자인으로 게임을 만들면 그 크레딧은 <b className="text-[#1f2937]">100% 디자이너에게</b> 쌓여요.</p>
          </div>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {NAV.slice(0, 4).map(([k, i, t, d]) => <div key={k} className={`${ui.card} p-4`}><p className="text-[24px]">{i}</p><p className="mt-1 text-[14px] font-extrabold text-[#1f2937]">{t}</p><p className="text-[12px] text-[#8a93a6] mt-0.5">{d}</p></div>)}
          </div>
          <div className={`${ui.card} mt-6 p-5 md:p-7`}>
            {status === 'pending' ? (
              <div className="text-center py-6">
                <CubeLoader size={52} />
                <p className="mt-2 text-[17px] font-extrabold text-[#1f2937]">접수 확인 중이에요</p>
                <p className="mt-1 text-[13px] text-[#4b5563]">관리자가 승인하면 이 화면이 바로 디자이너 작업 공간으로 바뀌어요. 메일로도 알려드려요.</p>
              </div>
            ) : (
              <>
                <h2 className="text-[18px] font-extrabold text-[#1f2937]">디자이너 접수</h2>
                <p className="text-[12.5px] text-[#4b5563] mt-1">{status === 'rejected' ? '지난 접수는 반려됐어요. 포트폴리오를 보강해 다시 접수할 수 있어요.' : '일반 회원 누구나 접수할 수 있어요. 관리자가 확인한 뒤 승인하면 디자인 AI 가 열려요.'}</p>
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
          {/* 얇은 레일 — 외계 기호 타일 (무대를 넓게) */}
          <aside className="md:w-[60px] shrink-0 md:min-h-[calc(100svh-2.75rem)] md:border-r border-white/70 bg-white/30 backdrop-blur-2xl md:sticky md:top-11 md:self-start">
            <nav className="flex md:flex-col items-center gap-1 p-1.5 md:pt-3 overflow-x-auto scrollbar-hide">
              {NAV.map(([k, , t, d]) => (
                <button key={k} onClick={() => go(k)} title={`${t} — ${d}`}
                  className={`group shrink-0 flex md:flex-col items-center justify-center gap-1.5 md:gap-1 rounded-[4px] px-3 md:px-0 h-10 md:h-[50px] md:w-[50px] transition-all ${section === k ? 'bg-gradient-to-br from-[#2563eb] to-[#38bdf8] text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.75)]' : 'text-[#374151] hover:bg-white/70 border border-transparent hover:border-[#dde3ee]'}`}>
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="miter" aria-hidden>{ICON[k]}</svg>
                  <span className={`text-[9.5px] font-bold whitespace-nowrap md:tracking-tight ${section === k ? 'text-white/90' : 'text-[#6b7280]'}`}>{t.replace('내 ', '').replace('전체 ', '').replace(' 작품', '')}</span>
                </button>
              ))}
            </nav>
          </aside>
          <main className="flex-1 min-w-0 p-4 md:p-6">
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
