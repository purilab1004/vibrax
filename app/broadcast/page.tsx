'use client'
// /broadcast — 폰 카메라로 내 게임 BJ 방송하기 (WebRTC P2P). 화면을 켜 둔 동안만 방송된다.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { loadAvatarConfig, saveAvatarConfig } from '@/lib/jeumto/storage'
import { emptyConfig, type AvatarConfig } from '@/lib/jeumto/config'
import { startHost, type HostHandle } from '@/lib/live/host'
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
  const hostRef = useRef<HostHandle | null>(null)
  const wakeRef = useRef<{ release(): Promise<void> } | null>(null)

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
    const t0 = Date.now()
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
      hostRef.current = startHost(supabase, user.id, stream, setViewers)
      const e = await setBroadcast(true)
      if (e) throw new Error(e)
      setOnAir(true)
      try { wakeRef.current = await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null } catch { /* ignore */ }
    } catch (e) {
      hostRef.current?.stop(); hostRef.current = null
      setErr(e instanceof Error ? e.message : '카메라를 켤 수 없어요')
    }
  }
  const stop = async () => {
    hostRef.current?.stop(); hostRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    wakeRef.current?.release().catch(() => {}); wakeRef.current = null
    setOnAir(false); setViewers(0)
    await setBroadcast(false)
  }
  useEffect(() => () => { hostRef.current?.stop() }, [])
  // 페이지 떠나면(닫기/새로고침) 방송 OFF 로 — 이후 시청자에겐 '방송 준비 중' 대신 아바타가 나오도록
  useEffect(() => {
    if (!onAir || !user) return
    const h = () => {
      const base = config ?? emptyConfig()
      const body = JSON.stringify({ avatar_config: { ...base, broadcast: { ...(base.broadcast ?? {}), mode: 'camera', url: base.broadcast?.url ?? '', on: false, gameId: gameId || null } } })
      // sendBeacon 은 supabase-js 를 못 쓰니 REST 로 직접 (세션 토큰 필요) — 최선의 노력
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token
        if (!token) return
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
          method: 'PATCH', keepalive: true,
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body,
        }).catch(() => {})
      })
    }
    window.addEventListener('pagehide', h)
    return () => window.removeEventListener('pagehide', h)
  }, [onAir, user, config, supabase, gameId])

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

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col">
      <div className="app-top-pad flex items-center gap-3 px-4 h-12 shrink-0 box-content">
        <button onClick={async () => { if (onAir) await stop(); router.push('/profile') }} className="font-pixel text-[11px] text-white/70 tracking-widest">← 내정보</button>
        <span className="font-pixel text-[11px] tracking-widest text-[#ff6b8a]">📱 폰 카메라 방송</span>
        <div className="flex-1" />
        {onAir && <span className="font-pixel text-[10px] tracking-widest text-white/80">👥 {viewers} · {mmss}</span>}
        {!onAir && links.some((l) => l.on) && <span className="font-pixel text-[10px] tracking-widest text-[#ff6b8a] animate-pulse">● 링크 {links.filter((l) => l.on).length}개 ON AIR</span>}
      </div>
      {!onAir && (
        <div className="shrink-0 px-4 pb-2 flex gap-2">
          <button onClick={() => setTab('camera')} className={`flex-1 rounded-full py-2 font-pixel text-[11px] tracking-widest border ${tab === 'camera' ? 'bg-white text-black border-white' : 'border-white/30 text-white/70'}`}>📱 폰 카메라</button>
          <button onClick={() => { setTab('link'); cancelEdit() }} className={`flex-1 rounded-full py-2 font-pixel text-[11px] tracking-widest border ${tab === 'link' ? 'bg-white text-black border-white' : 'border-white/30 text-white/70'}`}>🔗 라이브 링크</button>
          <button onClick={() => { setTab('video'); cancelEdit() }} className={`flex-1 rounded-full py-2 font-pixel text-[11px] tracking-widest border ${tab === 'video' ? 'bg-white text-black border-white' : 'border-white/30 text-white/70'}`}>▶ 영상</button>
        </div>
      )}
      <div className="relative flex-1 min-h-0">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }} />
        {onAir && (
          <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-[#e11d48] font-pixel text-[10px] px-2.5 py-1 tracking-widest">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> ON AIR
          </span>
        )}
        {!onAir && (
          <div className="absolute inset-0 overflow-y-auto flex flex-col items-center justify-center gap-4 px-8 py-6 text-center">
            {tab === 'camera' ? (
              <p className="text-sm text-white/85 leading-relaxed">방송을 시작하면 <b>추천 게임 카드</b>에 이 카메라 영상이 나오고, 코인을 넣으면 그 게임을 바로 플레이해요.<br />게임 안에서도 AJ 아바타 대신 방송이 BJ 자리에 나와요. 이 화면을 켜 둔 동안만 방송됩니다.</p>
            ) : (
              <div ref={formRef} className="w-full max-w-sm text-left space-y-2">
                {editingId && <p className="text-[12px] font-bold text-[#ffd166] text-center">✏️ 수정 중 — 아래 링크·제목·한 줄 소개·게임을 고치고 '저장'을 누르세요</p>}
                {tab === 'video'
                  ? <p className="text-sm text-white/85 leading-relaxed text-center">라이브가 아닌 <b>일반 영상</b>을 공유해요. YouTube 영상·쇼츠 링크를 게임에 연결하면 게임 목록에 <b>VIDEO 카드</b>로 나오고, 게임 안 BJ 자리에도 그 영상이 나와요. <b>여러 개</b> 등록할 수 있어요.</p>
                  : <p className="text-sm text-white/85 leading-relaxed text-center">YouTube 라이브/영상이나 Twitch 채널 링크를 게임에 연결하면 <b>LIVE 카드</b>로 목록에 나오고, 게임 안 BJ 자리에도 그 영상이 나와요. <b>여러 개</b> 계속 추가할 수 있어요.</p>}
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder={tab === 'video' ? 'https://youtube.com/watch?v=… 또는 https://youtube.com/shorts/…' : 'https://youtube.com/live/… 또는 https://twitch.tv/채널'}
                  className="w-full bg-white/10 border border-white/25 rounded-lg px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40"
                />
                <input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  maxLength={120}
                  placeholder="영상 제목 — 링크를 넣으면 자동으로 채워져요 (고칠 수 있음)"
                  className="w-full bg-white/10 border border-white/25 rounded-lg px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40"
                />
                <input
                  data-note
                  value={linkNote}
                  onChange={(e) => setLinkNote(e.target.value)}
                  maxLength={80}
                  placeholder="한 줄 소개 — 쇼츠 카드에 표시돼요 (예: 롤러코스터 1위 도전 하이라이트)"
                  className="w-full bg-white/10 border border-white/25 rounded-lg px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40"
                />
                {linkUrl && !toEmbed(linkUrl) && <p className="text-[11px] text-red-400">지원하지 않는 링크예요.</p>}
                {toEmbed(linkUrl) && (
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/60">
                    <iframe src={toEmbed(linkUrl)!.src} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                  </div>
                )}
                {linkMsg && <p className="text-[11px] text-[#7fd0ff]">{linkMsg}</p>}
                {shown.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    <li className="font-pixel text-[10px] tracking-widest text-white/60">{tab === 'video' ? '등록한 영상' : '추가한 라이브'} ({shown.length})</li>
                    {shown.map((l) => (
                      <li key={l.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${editingId === l.id ? 'border-white bg-white/15' : l.on ? 'border-[#e11d48]/70 bg-[#e11d48]/10' : 'border-white/15 bg-white/5'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] text-white truncate">{l.gameId ? `🎮 ${l.title ?? games.find((g) => g.id === l.gameId)?.title ?? '게임'}` : '▶ 게임 연결 없음 (영상만 공유)'}</p>
                          {l.videoTitle && <p className="text-[12px] text-white/90 truncate">{l.videoTitle}</p>}
                          {l.note && <p className="text-[11px] text-white/80 truncate">{l.note}</p>}
                          <p className="text-[10px] text-white/50 truncate">{l.url}</p>
                        </div>
                        <button onClick={() => editLink(l)} className={`font-pixel text-[9px] px-2 py-1 rounded-full tracking-widest ${editingId === l.id ? 'bg-white text-black' : 'bg-white/15 text-white/80'}`}>수정</button>
                        <button onClick={() => toggleLink(l.id)} className={`font-pixel text-[9px] px-2 py-1 rounded-full tracking-widest ${l.on ? 'bg-[#e11d48] text-white' : 'bg-white/15 text-white/70'}`}>{l.on ? '● ON' : '○ OFF'}</button>
                        <button onClick={() => removeLink(l.id)} aria-label="삭제" className="text-white/50 hover:text-white text-sm px-1">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="w-full max-w-sm text-left space-y-2">
              <span className="block font-pixel text-[10px] tracking-widest text-white/60">{tab === 'video' ? '추천 게임 (선택) — 안 고르면 영상만 공유돼요' : '추천 게임 — 내 게임이 아니어도 돼요'}</span>
              <div className="relative">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="게임 제목 검색…"
                  className="w-full bg-white/10 border border-white/25 rounded-lg px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40"
                />
                {results.length > 0 && (
                  <ul className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg bg-[#1a1a1f] border border-white/15 shadow-xl">
                    {results.map((g) => (
                      <li key={g.id}>
                        <button onClick={() => pick(g)} className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2">
                          {g.thumbnail_url && <span className="w-8 h-5 rounded bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${g.thumbnail_url})` }} />}
                          <span className="truncate">{g.title}</span>
                          <span className="ml-auto text-[10px] text-white/40 shrink-0">👥 {g.view_count ?? 0}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <select value={gameId} onChange={(e) => setGameId(e.target.value)} className="w-full bg-white/10 border border-white/25 rounded-lg px-3 py-2.5 text-sm text-white outline-none">
                {tab === 'video' && <option value="" className="text-black">게임 연결 안 함 — 영상만 공유</option>}
                {games.length === 0 && tab !== 'video' && <option value="">게임을 검색해서 골라 주세요</option>}
                {games.map((g) => <option key={g.id} value={g.id} className="text-black">{g.user_id === user?.id ? '★ ' : ''}{g.title}</option>)}
              </select>
              {selected && <p className="text-[11px] text-white/60">선택: <b className="text-white/90">{selected.title}</b>{selected.user_id === user?.id ? ' (내 게임)' : ''}</p>}
            </div>
            {err && <p className="text-[12px] text-red-400">{err}</p>}
          </div>
        )}
        {onAir && gameId && (
          <>
            <span className="absolute top-3 right-3 max-w-[60%] truncate rounded-full bg-black/55 text-white/90 text-[11px] px-2.5 py-1">🎮 {games.find((g) => g.id === gameId)?.title}</span>
            {/* 카메라를 켠 채 게임 하러 가기 — 새 탭에서 게임을 열면 내 플레이 화면 방송이 자동으로 켜지고, 시청자에겐 게임 화면 + 이 카메라(BJ 자리)가 함께 나온다. 이 탭은 닫지 말 것(카메라 송출) */}
            <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-1.5 px-4">
              <button
                onClick={() => window.open(`/games/${gameId}?play=1`, '_blank', 'noopener')}
                className="rounded-full bg-gradient-to-b from-[#ffd94f] to-[#ffb62e] text-[#3a2c00] font-bold text-[14px] px-6 py-3 shadow-[0_4px_0_#d18f00,0_8px_18px_rgba(0,0,0,.4)] active:translate-y-[2px] active:shadow-[0_2px_0_#d18f00]"
              >
                🎮 이 게임 하러 가기 — 내 플레이도 라이브로
              </button>
              <p className="text-[10.5px] text-white/70 text-center">새 탭에서 게임이 열리고 플레이 화면 방송이 자동으로 켜져요. 이 화면은 닫지 마세요(카메라 송출 중)</p>
            </div>
          </>
        )}
      </div>
      <div className="shrink-0 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-3">
        {tab === 'camera' && <button onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} disabled={onAir} className="rounded-full bg-white/15 px-4 py-3 text-[12px] disabled:opacity-40">🔄 {facing === 'user' ? '전면' : '후면'}</button>}
        {!onAir && tab !== 'camera' ? (
          <>
            {editingId && <button onClick={cancelEdit} className="rounded-full bg-white/15 px-5 py-3 font-pixel text-[12px] tracking-widest">취소</button>}
            <button onClick={addLink} disabled={!user || (!gameId && tab !== 'video') || !toEmbed(linkUrl)} className={`rounded-full px-8 py-3 font-pixel text-[12px] tracking-widest disabled:opacity-40 ${tab === 'video' ? 'bg-[#7c3aed]' : 'bg-[#e11d48]'}`}>{editingId ? '✓ 저장' : tab === 'video' ? '＋ 영상 등록' : '＋ 이 게임에 영상 추가'}</button>
          </>
        ) : !onAir ? (
          <button onClick={start} disabled={!user || !gameId} className="rounded-full bg-[#e11d48] px-8 py-3 font-pixel text-[12px] tracking-widest disabled:opacity-40">● 방송 시작</button>
        ) : (
          <button onClick={stop} className="rounded-full bg-white text-black px-8 py-3 font-pixel text-[12px] tracking-widest">■ 방송 종료</button>
        )}
      </div>
    </div>
  )
}
