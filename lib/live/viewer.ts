// lib/live/viewer.ts — 시청자: 호스트에게 join → offer 받고 answer → 스트림 수신
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import { ICE_SERVERS, liveChannelName, type Signal, type LiveChannelKind } from '@/lib/broadcast'

export type ViewerState = 'connecting' | 'waiting' | 'live' | 'ended'

export function startViewer(
  supabase: SupabaseClient,
  hostId: string,
  onStream: (s: MediaStream | null) => void,
  onState: (st: ViewerState) => void,
  kind: LiveChannelKind = 'cam',
): () => void {
  const me = `v_${Math.random().toString(36).slice(2, 10)}`
  let pc: RTCPeerConnection | null = null
  let hostOnline = false
  let joinTimer: ReturnType<typeof setInterval> | null = null
  const ch: RealtimeChannel = supabase.channel(liveChannelName(hostId, kind), { config: { broadcast: { self: false }, presence: { key: me } } })
  const send = (payload: Signal) => ch.send({ type: 'broadcast', event: 'signal', payload })

  const teardownPc = () => { pc?.close(); pc = null; onStream(null) }
  const join = () => { if (hostOnline && (!pc || pc.connectionState === 'failed')) send({ type: 'join', from: me }) }

  ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState() as Record<string, { role?: string }[]>
    hostOnline = Object.values(st).some((arr) => arr.some((p) => p.role === 'host'))
    if (!hostOnline) { teardownPc(); onState('waiting') } else if (!pc) { onState('connecting'); join() }
  })
  ch.on('broadcast', { event: 'signal' }, async ({ payload }: { payload: Signal }) => {
    try {
      if (payload.type === 'offer' && payload.to === me) {
        teardownPc()
        pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        // 트랙이 붙어도 ICE 연결이 끝나기 전엔 '연결 중' — 연결이 실제로 되면 그때 'live' (안 되면 검은 화면 대신 연결 중 표시 + 재시도)
        pc.ontrack = (e) => { onStream(e.streams[0]); if (pc && pc.connectionState === 'connected') onState('live') }
        pc.onicecandidate = (e) => { if (e.candidate) send({ type: 'ice', from: me, to: 'host', candidate: e.candidate.toJSON() }) }
        pc.onconnectionstatechange = () => {
          if (!pc) return
          if (pc.connectionState === 'connected') onState('live')
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') { teardownPc(); onState(hostOnline ? 'connecting' : 'waiting'); if (hostOnline) setTimeout(join, 1500) }
        }
        // 15초 안에 연결이 안 되면(NAT 차단 등) 끊고 다시 시도
        const started = pc
        setTimeout(() => { if (pc === started && pc.connectionState !== 'connected') { teardownPc(); onState(hostOnline ? 'connecting' : 'waiting'); if (hostOnline) join() } }, 15000)
        await pc.setRemoteDescription(payload.sdp)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        send({ type: 'answer', from: me, sdp: answer })
      } else if (payload.type === 'ice' && payload.to === me && pc) {
        await pc.addIceCandidate(payload.candidate).catch(() => {})
      }
    } catch (e) { console.warn('[live viewer] signal error', e) }
  })
  ch.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') { await ch.track({ role: 'viewer' }); onState('connecting'); joinTimer = setInterval(join, 4000); join() }
  })

  return () => {
    if (joinTimer) clearInterval(joinTimer)
    send({ type: 'bye', from: me })
    teardownPc()
    supabase.removeChannel(ch)
    onState('ended')
  }
}
