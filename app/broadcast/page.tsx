'use client'
// /broadcast — 폰 카메라로 내 게임 BJ 방송하기 (WebRTC P2P). 화면을 켜 둔 동안만 방송된다.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { loadAvatarConfig, saveAvatarConfig } from '@/lib/jeumto/storage'
import { emptyConfig, type AvatarConfig } from '@/lib/jeumto/config'
import { startCamLive, stopCamLive, getCamLive, subscribeCamLive } from '@/lib/live/camLive'
import { toEmbed, type LinkBroadcast } from '@/lib/broadcast'
import type { Game } from '@/lib/supabase/types'

export default function BroadcastPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)
  const [config, setConfig] = useState<AvatarConfig | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [gameId, setGameId] = useState<string>('')
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'camera' | 'link' | 'video'>('camera')
  const tabKind: 'live' | 'video' = tab === 'video' ? 'video' : 'live' // 링크 목록은 라이브/영상으로 나눠 보여준다
  const [linkUrl, setLinkUrl] = useState('')
  const [linkNote, setLinkNote] = useState('') // 한 줄 소개 — 쇼츠 카드에 표시
  const [linkTitle, setLinkTitle] = useState('') // 영상 제목 — 링크를 넣으면 YouTube 에서 자동으로 채우고, 고칠 수 있다
  const [links, setLinks] = useState<LinkBroadcast[]>([])
  const [linkMsg, setLinkMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null) // 수정 중인 링크 — 입력창에 불러와 '저장'으로 바꾼다
  const shown = links.filter((l) => (l.kind ?? 'live') === tabKind)
  const [results, setResults] = useState<Game[]>([])
  const [onAir, setOnAir] = useState(false)
  const [viewers, setViewers] = useState(0)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [err, setErr] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  // 방송 중인 카메라는 앱 전역(camLive)에 있다 — 게임 페이지에 다녀와도 이어지고, 돌아오면 다시 붙인다
  useEffect(() => {
    const sync = () => {
      const cur = getCamLive()
      setOnAir(!!cur); setViewers(cur?.viewers ?? 0)
      if (cur && videoRef.current && videoRef.current.srcObject !== cur.stream) { videoRef.current.srcObject = cur.stream; videoRef.current.muted = true }
    }
    const t = setTimeout(() => {
      const cur = getCamLive()
      if (cur) { setTab('camera'); setFacing(cur.facing); if (cur.gameId) setGameId(cur.gameId) }
      sync()
    }, 0)
    const unsub = subscribeCamLive(sync)
    return () => { clearTimeout(t); unsub() }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/broadcast'); return }
      setUser(user)
      const cfg = await loadAvatarConfig(supabase, user.id)
      setConfig(cfg)
      setLinks(cfg?.broadcasts ?? [])
      if ((cfg?.broadcasts?.length ?? 0) > 0 && !(cfg?.broadcast?.mode === 'camera' && cfg.broadcast.on)) setTab(cfg!.broadcasts!.some((l) => l.kind === 'video') && !cfg!.broadcasts!.some((l) => (l.kind ?? 'live') === 'live') ? 'video' : 'link')
      // 기본 목록: 내 게임 + 인기 게임(조회수순). 검색으로 아무 게임이나 고를 수 있다
      const [{ data: mine }, { data: top }] = await Promise.all([
        supabase.from('games').select('id,title,user_id,view_count,thumbnail_url').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('games').select('id,title,user_id,view_count,thumbnail_url').order('view_count', { ascending: false }).limit(20),
      ])
      const seen = new Set<string>()
      const list = [...(mine ?? []), ...(top ?? [])].filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true))) as Game[]
      setGames(list)
      // 이전에 고른 게임이 목록에 없으면 따로 받아서 넣는다
      const prev = cfg?.broadcast?.gameId
      if (prev && !list.some((g) => g.id === prev)) {
        const { data: g } = await supabase.from('games').select('id,title,user_id,view_count,thumbnail_url').eq('id', prev).maybeSingle()
        if (g) setGames([g as Game, ...list])
      }
      setGameId(prev ?? (mine?.[0]?.id ?? list[0]?.id ?? ''))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!onAir) return
    const t0 = getCamLive()?.startedAt ?? Date.now()
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [onAir])

  const persistLinks = async (next: LinkBroadcast[]) => {
    if (!user) return
    const base = config ?? emptyConfig()
    const merged: AvatarConfig = { ...base, broadcasts: next }
    const { error } = await saveAvatarConfig(supabase, user.id, merged)
    if (error) { setLinkMsg('저장 실패: ' + error); return }
    setConfig(merged); setLinks(next)
  }
  const addLink = async () => {
    if (!toEmbed(linkUrl)) { setLinkMsg(tab === 'video' ? '지원하지 않는 링크예요 (YouTube 영상/쇼츠)' : '지원하지 않는 링크예요 (YouTube/Twitch)'); return }
    if (!gameId && tab !== 'video') { setLinkMsg('연결할 게임을 골라 주세요'); return }
    const g = games.find((x) => x.id === gameId)
    if (editingId) {
      await persistLinks(links.map((l) => (l.id === editingId ? { ...l, url: linkUrl.trim(), gameId: gameId || null, title: g?.title, note: linkNote.trim() || undefined, videoTitle: linkTitle.trim() || undefined } : l)))
      setEditingId(null); setLinkUrl(''); setLinkNote(''); setLinkTitle('')
      setLinkMsg('✓ 수정했어요'); setTimeout(() => setLinkMsg(null), 2500)
      return
    }
    const item: LinkBroadcast = { id: `l_${Date.now().toString(36)}`, url: linkUrl.trim(), gameId: gameId || null, on: true, title: g?.title, kind: tabKind, note: linkNote.trim() || undefined, videoTitle: linkTitle.trim() || undefined }
    await persistLinks([item, ...links])
    setLinkUrl(''); setLinkNote(''); setLinkTitle('')
    setLinkMsg(tab === 'video' ? '▶ 등록했어요 — 게임 목록에 VIDEO 카드로 나와요' : '● 추가했어요 — 목록·게임 안에 영상이 나와요'); setTimeout(() => setLinkMsg(null), 2500)
  }
  const toggleLink = (id: string) => persistLinks(links.map((l) => (l.id === id ? { ...l, on: !l.on } : l)))
  const removeLink = (id: string) => { if (editingId === id) { setEditingId(null); setLinkUrl('') } return persistLinks(links.filter((l) => l.id !== id)) }
  const formRef = useRef<HTMLDivElement>(null)
  const editLink = (l: LinkBroadcast) => { setEditingId(l.id); setLinkUrl(l.url); setLinkNote(l.note ?? ''); setLinkTitle(l.videoTitle ?? ''); setGameId(l.gameId ?? ''); setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); formRef.current?.querySelector<HTMLInputElement>('input[data-note]')?.focus() }, 50); setLinkMsg('아래에서 링크·게임을 고치고 저장을 누르세요') }
  const cancelEdit = () => { setEditingId(null); setLinkUrl(''); setLinkNote(''); setLinkTitle(''); setLinkMsg(null) }
  // 링크를 넣으면 영상 제목 자동(YouTube oEmbed) — 이미 직접 쓴 제목은 덮지 않는다
  useEffect(() => {
    if (!toEmbed(linkUrl) || linkTitle.trim()) return
    let alive = true
    const t = setTimeout(() => { fetch(`/api/oembed?url=${encodeURIComponent(linkUrl.trim())}`).then(r => r.json()).then(j => { if (alive && j?.title && !linkTitle.trim()) setLinkTitle(String(j.title).slice(0, 120)) }).catch(() => {}) }, 400)
    return () => { alive = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkUrl])
  const setBroadcast = async (on: boolean) => {
    if (!user) return
    const base = config ?? emptyConfig()
    const next: AvatarConfig = { ...base, broadcast: { ...(base.broadcast ?? {}), mode: 'camera', url: base.broadcast?.url ?? '', on, gameId: gameId || null } }
    const { error } = await saveAvatarConfig(supabase, user.id, next)
    if (!error) setConfig(next)
    return error
  }

  const start = async () => {
    if (!user) return
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true }
      // 탭을 닫으면(pagehide) 방송 OFF — supabase-js 대신 REST keepalive (세션 토큰은 미리 잡아 둔다)
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      const base = config ?? emptyConfig()
      const offBody = JSON.stringify({ avatar_config: { ...base, broadcast: { ...(base.broadcast ?? {}), mode: 'camera', url: base.broadcast?.url ?? '', on: false, gameId: gameId || null } } })
      const onPageHide = () => {
        if (!token) return
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
          method: 'PATCH', keepalive: true,
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: offBody,
        }).catch(() => {})
      }
      await startCamLive(supabase, user.id, stream, { gameId: gameId || null, facing, onPageHide })
      const e = await setBroadcast(true)
      if (e) throw new Error(e)
    } catch (e) {
      stopCamLive()
      setErr(e instanceof Error ? e.message : '카메라를 켤 수 없어요')
    }
  }
  const stop = async () => {
    stopCamLive()
    if (videoRef.current) videoRef.current.srcObject = null
    await setBroadcast(false)
  }

  // 게임 검색 (제목 부분 일치) — 아무 게임이나 추천 게임으로 연결 가능
  useEffect(() => {
    const term = q.trim()
    let alive = true
    const t = setTimeout(async () => {
      if (!term) { if (alive) setResults([]); return }
      const { data } = await supabase.from('games').select('id,title,user_id,view_count,thumbnail_url').ilike('title', `%${term}%`).limit(12)
      if (alive) setResults((data ?? []) as Game[])
    }, term ? 250 : 0)
    return () => { alive = false; clearTimeout(t) }
  }, [q, supabase])
  const pick = (g: Game) => {
    setGames((prev) => (prev.some((x) => x.id === g.id) ? prev : [g, ...prev]))
    setGameId(g.id); setQ(''); setResults([])
  }
  const selected = games.find((g) => g.id === gameId)

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

  const ytThumb = (url: string) => { const e = toEmbed(url); const m = e?.src.match(/embed\/([\w-]{6,})/); return m ? `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg` : null }
  const TABS = [
    { key: 'camera' as const, label: '카메라', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10 5-3v10l-5-3" /></svg> },
    { key: 'link' as const, label: '라이브 링크', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg> },
    { key: 'video' as const, label: '영상', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg> },
  ]
  const inputCls = 'w-full h-11 rounded-xl bg-white/[0.07] border border-white/10 focus:border-[#ff4d7d]/70 focus:bg-white/[0.1] px-3.5 text-[14px] text-white outline-none placeholder:text-white/35 transition-colors'
  const card = 'rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-xl p-4'

  return (
    <div className="fixed inset-0 z-[70] bg-[#07060b] text-white flex flex-col">
      {/* 배경 오라 */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-24 w-80 h-80 rounded-full bg-[radial-gradient(closest-side,rgba(255,45,110,0.35),transparent)] blur-2xl" />
        <div className="absolute top-1/3 -right-28 w-80 h-80 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.35),transparent)] blur-2xl" />
      </div>

      {/* 상단 바 */}
      <div className="relative app-top-pad flex items-center gap-2.5 px-3 h-14 shrink-0 box-content">
        <button onClick={async () => { if (onAir) await stop(); router.push('/profile') }} aria-label="내정보로" className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center active:scale-95 transition-transform">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.28em] text-white/45 leading-none">BROADCAST</p>
          <p className="text-[17px] font-extrabold leading-tight flex items-center gap-1.5">ON AIR <span className={`w-2 h-2 rounded-full ${onAir || links.some((l) => l.on) ? 'bg-[#ff2d55] animate-pulse shadow-[0_0_10px_#ff2d55]' : 'bg-white/25'}`} /></p>
        </div>
        <div className="flex-1" />
        {onAir && (
          <div className="flex items-center gap-1.5">
            <span className="h-8 px-2.5 rounded-full bg-white/10 border border-white/10 text-[12px] font-semibold flex items-center gap-1"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>{viewers}</span>
            <span className="h-8 px-2.5 rounded-full bg-[#ff2d55] text-[12px] font-bold tabular-nums flex items-center">{mmss}</span>
          </div>
        )}
        {!onAir && links.some((l) => l.on) && <span className="h-8 px-3 rounded-full bg-[#ff2d55]/15 border border-[#ff2d55]/40 text-[#ff8aa6] text-[12px] font-bold flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#ff2d55] animate-pulse" />링크 {links.filter((l) => l.on).length}개 ON</span>}
      </div>

      {/* 탭 — 세그먼트 */}
      {!onAir && (
        <div className="relative shrink-0 px-3 pb-3">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-white/[0.06] border border-white/10">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => { setTab(t.key); if (t.key !== 'camera') cancelEdit() }} className={`h-10 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all ${tab === t.key ? 'bg-gradient-to-r from-[#ff2d6f] to-[#8b3dff] text-white shadow-[0_6px_18px_-6px_rgba(255,45,111,0.7)]' : 'text-white/55 active:bg-white/5'}`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover ${onAir ? '' : 'hidden'}`} style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }} />
        {onAir && (
          <>
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
            <div className="absolute top-3 left-3 right-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-lg bg-[#ff2d55] px-2.5 py-1 text-[12px] font-extrabold tracking-wide shadow-[0_6px_18px_-6px_rgba(255,45,85,.8)]"><span className="w-2 h-2 rounded-full bg-white animate-pulse" />LIVE</span>
              {selected && <span className="min-w-0 flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/15 pl-1 pr-3 py-1 text-[12px] font-semibold">{selected.thumbnail_url && <span className="w-6 h-6 rounded-full bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${selected.thumbnail_url})` }} />}<span className="truncate">{selected.title}</span></span>}
            </div>
          </>
        )}

        {!onAir && (
          <div className="absolute inset-0 overflow-y-auto px-3 pb-6 space-y-3">
            {tab === 'camera' ? (
              <div className={`${card} relative overflow-hidden`}>
                <div aria-hidden className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-[radial-gradient(closest-side,rgba(255,45,111,0.35),transparent)]" />
                <div className="relative flex items-center gap-3">
                  <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ff2d6f] to-[#8b3dff] flex items-center justify-center shadow-[0_10px_24px_-10px_rgba(255,45,111,0.8)]"><svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10 5-3v10l-5-3" /></svg></span>
                  <div className="min-w-0"><p className="text-[16px] font-extrabold">폰 카메라로 라이브</p><p className="text-[12px] text-white/55 leading-snug">추천 게임 카드와 게임 안 BJ 자리에 내 카메라가 나와요</p></div>
                </div>
                <div className="relative mt-3 grid grid-cols-3 gap-2">
                  {['게임 고르기', '방송 시작', '방송하며 플레이'].map((t, i) => (
                    <div key={t} className="rounded-xl bg-white/[0.06] border border-white/10 px-2 py-2.5 text-center"><p className="text-[10px] font-bold text-[#ff8aa6]">STEP {i + 1}</p><p className="text-[12px] font-semibold mt-0.5">{t}</p></div>
                  ))}
                </div>
              </div>
            ) : (
              <div ref={formRef} className={`${card} space-y-2.5`}>
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-extrabold">{editingId ? '✏️ 수정 중' : tab === 'video' ? '영상 공유' : '라이브 링크 연결'}</p>
                  <span className="text-[11px] text-white/45">{tab === 'video' ? 'YouTube 영상·쇼츠' : 'YouTube Live · Twitch'}</span>
                </div>
                <p className="text-[12px] text-white/55 leading-relaxed">{tab === 'video' ? '게임에 연결하면 쇼츠 피드에 VIDEO 카드로, 게임 안 BJ 자리에도 나와요. 여러 개 등록할 수 있어요.' : '게임에 연결하면 쇼츠 피드에 LIVE 카드로, 게임 안 BJ 자리에도 나와요. 여러 개 추가할 수 있어요.'}</p>
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder={tab === 'video' ? 'https://youtube.com/shorts/…' : 'https://youtube.com/live/… · twitch.tv/채널'} className={inputCls} />
                <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} maxLength={120} data-note placeholder="쇼츠에 나올 한 줄 제목 (링크를 넣으면 자동으로 채워져요)" className={inputCls} />
                {linkUrl && !toEmbed(linkUrl) && <p className="text-[12px] text-[#ff8aa6]">지원하지 않는 링크예요.</p>}
                {toEmbed(linkUrl) && (
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black/60 border border-white/10">
                    <iframe src={toEmbed(linkUrl)!.src} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                  </div>
                )}
                {linkMsg && <p className="text-[12px] text-[#7fd0ff]">{linkMsg}</p>}
              </div>
            )}

            {/* 추천 게임 */}
            <div className={card}>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[15px] font-extrabold">추천 게임</p>
                <span className="text-[11px] text-white/45">{tab === 'video' ? '선택 — 안 고르면 영상만 공유' : '내 게임이 아니어도 돼요'}</span>
              </div>
              <div className="relative">
                <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="게임 제목 검색" className={`${inputCls} pl-9`} />
                {results.length > 0 && (
                  <ul className="absolute z-10 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto rounded-xl bg-[#16141d] border border-white/15 shadow-2xl p-1">
                    {results.map((g) => (
                      <li key={g.id}>
                        <button onClick={() => pick(g)} className="w-full text-left px-2 py-2 rounded-lg text-[13px] hover:bg-white/10 flex items-center gap-2.5">
                          {g.thumbnail_url ? <span className="w-9 h-9 rounded-lg bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${g.thumbnail_url})` }} /> : <span className="w-9 h-9 rounded-lg bg-white/10 shrink-0" />}
                          <span className="truncate font-semibold">{g.title}</span>
                          <span className="ml-auto text-[11px] text-white/40 shrink-0">👁 {g.view_count ?? 0}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-3 -mx-4 px-4 flex gap-2.5 overflow-x-auto scrollbar-hide snap-x">
                {tab === 'video' && (
                  <button onClick={() => setGameId('')} className={`snap-start shrink-0 w-[104px] rounded-2xl p-1.5 text-left border transition-all ${gameId === '' ? 'border-[#ff2d6f] bg-[#ff2d6f]/10' : 'border-white/10 bg-white/[0.04]'}`}>
                    <span className="block aspect-square rounded-xl bg-white/[0.06] flex items-center justify-center text-[22px]">🎬</span>
                    <span className="block mt-1.5 text-[11.5px] font-semibold leading-tight line-clamp-2">연결 안 함</span>
                  </button>
                )}
                {games.map((g) => (
                  <button key={g.id} onClick={() => setGameId(g.id)} className={`snap-start shrink-0 w-[104px] rounded-2xl p-1.5 text-left border transition-all ${gameId === g.id ? 'border-[#ff2d6f] bg-[#ff2d6f]/10 shadow-[0_8px_20px_-10px_rgba(255,45,111,0.8)]' : 'border-white/10 bg-white/[0.04]'}`}>
                    <span className="relative block aspect-square rounded-xl bg-cover bg-center bg-white/10" style={g.thumbnail_url ? { backgroundImage: `url(${g.thumbnail_url})` } : undefined}>
                      {g.user_id === user?.id && <span className="absolute top-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold">MY</span>}
                      {gameId === g.id && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#ff2d6f] flex items-center justify-center"><svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg></span>}
                    </span>
                    <span className="block mt-1.5 text-[11.5px] font-semibold leading-tight line-clamp-2">{g.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 등록한 링크·영상 목록 */}
            {tab !== 'camera' && shown.length > 0 && (
              <div className={card}>
                <p className="text-[15px] font-extrabold mb-2.5">{tab === 'video' ? '등록한 영상' : '추가한 라이브'} <span className="text-white/40 font-bold">{shown.length}</span></p>
                <ul className="space-y-2">
                  {shown.map((l) => {
                    const thumb = ytThumb(l.url)
                    return (
                      <li key={l.id} className={`flex items-center gap-3 rounded-xl p-2 border transition-colors ${editingId === l.id ? 'border-white/60 bg-white/10' : 'border-white/10 bg-white/[0.03]'}`}>
                        <span className="relative w-14 h-14 rounded-lg overflow-hidden bg-white/10 shrink-0 bg-cover bg-center" style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}>
                          {!thumb && <span className="absolute inset-0 flex items-center justify-center text-lg">{tab === 'video' ? '▶' : '🔗'}</span>}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold truncate">{l.videoTitle || l.url}</p>
                          <p className="text-[11px] text-white/50 truncate">{l.gameId ? `🎮 ${l.title ?? games.find((g) => g.id === l.gameId)?.title ?? '게임'}` : '게임 연결 없음'}</p>
                        </div>
                        <button onClick={() => editLink(l)} aria-label="수정" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 active:scale-95"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg></button>
                        <button onClick={() => toggleLink(l.id)} role="switch" aria-checked={l.on} aria-label={l.on ? '끄기' : '켜기'} className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${l.on ? 'bg-[#ff2d55]' : 'bg-white/20'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${l.on ? 'left-[22px]' : 'left-0.5'}`} /></button>
                        <button onClick={() => removeLink(l.id)} aria-label="삭제" className="w-8 h-8 rounded-full flex items-center justify-center text-white/45 active:text-white shrink-0"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {err && <p className="text-[13px] text-[#ff8aa6] text-center">{err}</p>}
          </div>
        )}
      </div>

      {/* 하단 액션 */}
      <div className="relative shrink-0 px-3 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/85 to-transparent space-y-2">
        {onAir && gameId && (
          <button onClick={() => router.push(`/games/${gameId}?play=1`)} className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#ffd94f] to-[#ffb62e] text-[#3a2c00] font-extrabold text-[16px] flex items-center justify-center gap-2 shadow-[0_10px_28px_-10px_rgba(255,190,50,0.8)] active:scale-[0.99]">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="11" rx="4" /><path d="M7 11v3M5.5 12.5h3M16 12h.01M18 14h.01" /></svg>
            라이브 방송하면서 게임하기
          </button>
        )}
        <div className="flex items-center gap-2">
          {tab === 'camera' && (
            <button onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} disabled={onAir} aria-label="카메라 전환" className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex flex-col items-center justify-center gap-0.5 disabled:opacity-40 shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></svg>
              <span className="text-[9.5px] font-semibold text-white/70">{facing === 'user' ? '전면' : '후면'}</span>
            </button>
          )}
          {!onAir && tab !== 'camera' ? (
            <>
              {editingId && <button onClick={cancelEdit} className="h-14 px-5 rounded-2xl bg-white/10 border border-white/10 text-[14px] font-bold shrink-0">취소</button>}
              <button onClick={addLink} disabled={!user || (!gameId && tab !== 'video') || !toEmbed(linkUrl)} className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-[#ff2d6f] to-[#8b3dff] text-[16px] font-extrabold disabled:opacity-35 shadow-[0_10px_28px_-10px_rgba(255,45,111,0.8)]">{editingId ? '저장하기' : tab === 'video' ? '영상 등록하기' : '라이브 추가하기'}</button>
            </>
          ) : !onAir ? (
            <button onClick={start} disabled={!user || !gameId} className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-[#ff2d55] to-[#ff5e3a] text-[16px] font-extrabold flex items-center justify-center gap-2 disabled:opacity-35 shadow-[0_10px_28px_-10px_rgba(255,45,85,0.85)]">
              <span className="w-3 h-3 rounded-full bg-white" />방송 시작
            </button>
          ) : (
            <button onClick={stop} className="flex-1 h-14 rounded-2xl bg-white/10 border border-white/20 text-[16px] font-extrabold flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-[3px] bg-[#ff2d55]" />방송 종료
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
