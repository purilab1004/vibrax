'use client'
// 쇼츠 배경음 컨트롤러 — 화면에 보이는 카드의 카테고리에 맞는 곡을 하나의 <audio> 로 재생한다.
//  · 브라우저 자동재생 정책: 첫 사용자 입력(탭·클릭·키) 안에서 바로 play() 해 잠금을 푼다
//  · 같은 곡이면 이어서, 다른 곡이면 교체. 음소거는 기기에 기억(localStorage)
//  · 피드를 떠나거나(언마운트) 탭이 숨겨지면 멈춘다
import { useEffect, useSyncExternalStore, type RefObject } from 'react'
import { FEED_BGM, type BgmTrack } from '@/lib/feedBgmConfig'

const MUTE_KEY = 'feed_bgm_muted'
let urls: Record<string, string> | null = null
let urlsLoading: Promise<void> | null = null
let audio: HTMLAudioElement | null = null
let wanted: BgmTrack | null = null
let unlocked = false
let active = 0            // 마운트된 피드 수
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false } })()
const subs = new Set<() => void>()

function loadUrls() {
  if (urls || urlsLoading) return urlsLoading
  urlsLoading = fetch('/api/media/bgm').then((r) => r.json()).then((j) => { urls = j.urls ?? {} }).catch(() => { urls = {} }).finally(() => { urlsLoading = null; apply() })
  return urlsLoading
}

// 동기 — 사용자 입력 핸들러 안에서도 await 없이 play() 가 호출되게
function apply() {
  if (typeof window === 'undefined') return
  const shouldPlay = !!wanted && !muted && active > 0 && !document.hidden
  if (!shouldPlay) { audio?.pause(); return }
  const url = urls?.[wanted!.name]
  if (!url) { audio?.pause(); if (!urls) loadUrls(); return }
  if (!audio) { audio = new Audio(); audio.preload = 'auto' }
  if (audio.dataset.name !== wanted!.name) { audio.src = url; audio.dataset.name = wanted!.name; audio.currentTime = 0 }
  audio.loop = wanted!.loop
  audio.volume = wanted!.volume   // iOS 는 volume 이 무시되고 항상 1
  if (!unlocked) return
  if (audio.paused) { const p = audio.play(); if (p) p.catch(() => {}) }
}

function onGesture() { unlocked = true; apply() }
function onVisibility() { apply() }

export function setFeedTrack(key: string | null) {
  wanted = key ? FEED_BGM[key] ?? null : null
  apply()
}

export function setFeedBgmMuted(m: boolean) {
  muted = m
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch {}
  apply(); subs.forEach((f) => f())
}

/** 피드 컨테이너에서 한 번 — 입력 잠금 해제·탭 전환 처리, 떠나면 정지 */
export function useFeedBgmHost() {
  useEffect(() => {
    active++
    loadUrls()
    const opts = { capture: true, passive: true } as const
    window.addEventListener('pointerdown', onGesture, opts)
    window.addEventListener('touchend', onGesture, opts)
    window.addEventListener('keydown', onGesture, opts)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = Math.max(0, active - 1)
      window.removeEventListener('pointerdown', onGesture, opts)
      window.removeEventListener('touchend', onGesture, opts)
      window.removeEventListener('keydown', onGesture, opts)
      document.removeEventListener('visibilitychange', onVisibility)
      if (active === 0) { wanted = null; apply() }
    }
  }, [])
}

/** 카드마다 — 화면 대부분(60%↑)이 보이면 이 카드의 곡으로 바꾼다. key=null 이면 배경음 끔(라이브·영상) */
export function useFeedTrack(ref: RefObject<HTMLElement | null>, key: string | null, enabled = true) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setFeedTrack(key) }, { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, key, enabled])
}

export function useFeedBgmMuted() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => muted, () => false)
}
