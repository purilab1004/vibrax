'use client'
// 쇼츠 공용 소리 버튼 — 모든 카드(게임·잭팟·영상) 좌측 상단 같은 자리, 같은 모양(둥근 스피커).
// 하나의 '소리' 설정: 끄면 배경음·영상 소리 모두 끄고, 켜면 모두 켠다(기기에 기억)
import { setFeedBgmMuted, useFeedBgmMuted } from '@/lib/feedBgm'
import { setSoundPref } from '@/lib/live/soundPref'

export function SoundIconButton({ muted, onToggle, className = '' }: { muted: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      aria-label={muted ? '소리 켜기' : '소리 끄기'}
      title={muted ? '소리 켜기' : '소리 끄기'}
      className={`absolute z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,.3)] active:scale-95 transition-transform ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        {muted ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19.5 5.5a9 9 0 0 1 0 13" />}
      </svg>
    </button>
  )
}

/** 게임·잭팟 카드용 — 배경음 기준 표시, 누르면 배경음·영상 소리 설정을 함께 바꾼다 */
export default function FeedSoundButton({ className = '' }: { className?: string }) {
  const muted = useFeedBgmMuted()
  return <SoundIconButton muted={muted} onToggle={() => { const nextMuted = !muted; setFeedBgmMuted(nextMuted); setSoundPref({ on: !nextMuted }) }} className={className} />
}
