// lib/live/host.ts — 방송 호스트(폰 카메라). 시청자마다 RTCPeerConnection 하나씩(P2P, 시청자 수 소규모용).
// 시그널링은 Supabase Realtime broadcast 채널. 호스트는 presence 로 "온라인"을 알린다.
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import { ICE_SERVERS, liveChannelName, type Signal, type LiveChannelKind } from '@/lib/broadcast'
import { trackHost } from '@/lib/live/hostsPresence'

export interface HostHandle {
  stop(): void
  viewers(): number
}

export function startHost(supabase: SupabaseClient, hostId: string, stream: MediaStream, onViewers?: (n: number) => void, kind: LiveChannelKind = 'cam'): HostHandle {
  const peers = new Map<string, RTCPeerConnection>()
  // 시청자 answer 적용 전에 도착한 ICE 후보 — 버리지 않고 모았다가 넣는다(연결 지연 방지)
  const pendingIce = new Map<string, RTCIceCandidateInit[]>()
  const ch: RealtimeChannel = supabase.channel(liveChannelName(hostId, kind), { config: { broadcast: { self: false }, presence: { key: 'host' } } })
  const send = (payload: Signal) => ch.send({ type: 'broadcast', event: 'signal', payload })
  const notify = () => onViewers?.(peers.size)

  const sids = new Map<string, string>()   // 시청자별 현재 offer id
  const closePeer = (id: string) => { peers.get(id)?.close(); peers.delete(id); pendingIce.delete(id); notify() }

  const connect = async (viewerId: string) => {
    closePeer(viewerId)
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    peers.set(viewerId, pc); notify()
    for (const t of stream.getTracks()) {
      // 게임 화면은 글자·픽셀이 또렷하게(해상도 유지), 카메라는 움직임 우선
      if (t.kind === 'video') { try { (t as MediaStreamTrack & { contentHint: string }).contentHint = kind === 'screen' ? 'detail' : 'motion' } catch { /* noop */ } }
      pc.addTrack(t, stream)
    }
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: 'ice', from: 'host', to: viewerId, candidate: e.candidate.toJSON() }) }
    // 모바일 망에선 'disconnected' 가 잠깐씩 뜨고 스스로 회복된다 — 바로 끊으면 시청자 화면이 꺼지므로 8초 유예
    let dcTimer: ReturnType<typeof setTimeout> | null = null
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      if (st === 'failed' || st === 'closed') { if (dcTimer) clearTimeout(dcTimer); if (peers.get(viewerId) === pc) closePeer(viewerId); return }
      if (st === 'disconnected') { if (!dcTimer) dcTimer = setTimeout(() => { dcTimer = null; if (pc.connectionState !== 'connected' && peers.get(viewerId) === pc) closePeer(viewerId) }, 8000) }
      else if (dcTimer) { clearTimeout(dcTimer); dcTimer = null }
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    // 기본 비트레이트(낮게 잡힘) 대신 넉넉히 — 화면 방송은 해상도 유지 (인코딩은 로컬 SDP 적용 후에 생긴다)
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue
      const p = sender.getParameters() as RTCRtpSendParameters & { degradationPreference?: string }
      if (!p.encodings?.length) continue
      p.encodings[0].maxBitrate = kind === 'screen' ? 2_500_000 : 1_200_000
      p.encodings[0].maxFramerate = kind === 'screen' ? 30 : 24
      p.degradationPreference = kind === 'screen' ? 'maintain-resolution' : 'balanced'
      sender.setParameters(p).catch(() => {})
    }
    const sid = Math.random().toString(36).slice(2, 10)
    sids.set(viewerId, sid)
    send({ type: 'offer', to: viewerId, sdp: offer, sid })
  }

  ch.on('broadcast', { event: 'signal' }, async ({ payload }: { payload: Signal }) => {
    try {
      if (payload.type === 'join') await connect(payload.from)
      else if (payload.type === 'answer') {
        const pc = peers.get(payload.from)
        if (payload.sid && sids.get(payload.from) !== payload.sid) return   // 예전 offer 에 대한 answer — 무시
        if (pc && pc.signalingState !== 'stable') { await pc.setRemoteDescription(payload.sdp); for (const c of pendingIce.get(payload.from)?.splice(0) ?? []) await pc.addIceCandidate(c).catch(() => {}) }
      }
      else if (payload.type === 'ice' && payload.to === 'host') {
        const pc = peers.get(payload.from)
        if (pc && pc.remoteDescription) await pc.addIceCandidate(payload.candidate).catch(() => {})
        else { const q = pendingIce.get(payload.from) ?? []; q.push(payload.candidate); pendingIce.set(payload.from, q) }
      }
      else if (payload.type === 'bye') closePeer(payload.from)
    } catch (e) { console.warn('[live host] signal error', e) }
  })
  ch.subscribe(async (status) => { if (status === 'SUBSCRIBED') await ch.track({ role: 'host', at: Date.now() }) })
  // 실시간 연결이 재접속돼도 '방송 중' presence 가 사라지지 않게 주기적으로 다시 알린다
  const beat = setInterval(() => { ch.track({ role: 'host', at: Date.now() }).catch(() => {}) }, 25_000)
  // 전역 온라인 표시 — 피드는 DB 의 방송 플래그만 믿지 않고, 지금 실제로 접속 중인 방송자만 LIVE 카드로 보여 준다(앱 강제 종료·네트워크 끊김 시 자동으로 사라짐)
  const untrackOnline = trackHost(hostId, kind === 'screen' ? 'screen' : 'cam')

  return {
    stop() {
      clearInterval(beat)
      for (const id of [...peers.keys()]) closePeer(id)
      ch.untrack().catch(() => {})
      supabase.removeChannel(ch)
      untrackOnline()
      for (const t of stream.getTracks()) t.stop()
    },
    viewers: () => peers.size,
  }
}
