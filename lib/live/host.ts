// lib/live/host.ts — 방송 호스트(폰 카메라). 시청자마다 RTCPeerConnection 하나씩(P2P, 시청자 수 소규모용).
// 시그널링은 Supabase Realtime broadcast 채널. 호스트는 presence 로 "온라인"을 알린다.
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import { ICE_SERVERS, liveChannelName, type Signal } from '@/lib/broadcast'

export interface HostHandle {
  stop(): void
  viewers(): number
}

export function startHost(supabase: SupabaseClient, hostId: string, stream: MediaStream, onViewers?: (n: number) => void): HostHandle {
  const peers = new Map<string, RTCPeerConnection>()
  const ch: RealtimeChannel = supabase.channel(liveChannelName(hostId), { config: { broadcast: { self: false }, presence: { key: 'host' } } })
  const send = (payload: Signal) => ch.send({ type: 'broadcast', event: 'signal', payload })
  const notify = () => onViewers?.(peers.size)

  const closePeer = (id: string) => { peers.get(id)?.close(); peers.delete(id); notify() }

  const connect = async (viewerId: string) => {
    closePeer(viewerId)
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    peers.set(viewerId, pc); notify()
    for (const t of stream.getTracks()) pc.addTrack(t, stream)
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: 'ice', from: 'host', to: viewerId, candidate: e.candidate.toJSON() }) }
    pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) closePeer(viewerId) }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ type: 'offer', to: viewerId, sdp: offer })
  }

  ch.on('broadcast', { event: 'signal' }, async ({ payload }: { payload: Signal }) => {
    try {
      if (payload.type === 'join') await connect(payload.from)
      else if (payload.type === 'answer') { const pc = peers.get(payload.from); if (pc && pc.signalingState !== 'stable') await pc.setRemoteDescription(payload.sdp) }
      else if (payload.type === 'ice' && payload.to === 'host') { const pc = peers.get(payload.from); if (pc) await pc.addIceCandidate(payload.candidate).catch(() => {}) }
      else if (payload.type === 'bye') closePeer(payload.from)
    } catch (e) { console.warn('[live host] signal error', e) }
  })
  ch.subscribe(async (status) => { if (status === 'SUBSCRIBED') await ch.track({ role: 'host', at: Date.now() }) })

  return {
    stop() {
      for (const id of [...peers.keys()]) closePeer(id)
      ch.untrack().catch(() => {})
      supabase.removeChannel(ch)
      for (const t of stream.getTracks()) t.stop()
    },
    viewers: () => peers.size,
  }
}
