'use client'
// 일반 AI / 개발 AI 모드 스위치 — 브라우저에 기억 (스튜디오 첫 화면·채팅 공용 키 vx_studio_mode)
import { useSyncExternalStore } from 'react'

const KEY = 'vx_studio_mode', EVT = 'vx-studio-mode'
const read = () => { try { return localStorage.getItem(KEY) === 'dev' } catch { return false } }
const sub = (fn: () => void) => { window.addEventListener(EVT, fn); window.addEventListener('storage', fn); return () => { window.removeEventListener(EVT, fn); window.removeEventListener('storage', fn) } }
export function setAiMode(dev: boolean) { try { localStorage.setItem(KEY, dev ? 'dev' : 'normal') } catch { /* 저장소 없음 */ } window.dispatchEvent(new Event(EVT)) }
export function useAiMode(): boolean { return useSyncExternalStore(sub, read, () => false) }

export default function AiModeToggle({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const dev = useAiMode()
  const h = size === 'md' ? 'h-9 px-4 text-[13px]' : 'h-7 px-2.5 text-[11.5px]'
  return (
    <div className="inline-flex items-center rounded-full bg-[#f1ede4] p-0.5 border border-[#e6dfd0]" role="radiogroup" aria-label="AI 모드">
      <button type="button" role="radio" aria-checked={!dev} onClick={() => setAiMode(false)} title="프롬프트만으로 바로 만들기"
        className={`${h} rounded-full font-bold transition-colors ${!dev ? 'bg-white text-[#241f17] shadow-sm' : 'text-[#9d9280] hover:text-[#4a4337]'}`}>일반 AI</button>
      <button type="button" role="radio" aria-checked={dev} onClick={() => setAiMode(true)} title="2D/3D·그래픽·플레이·스토리·조작·난이도를 정하고 만들기"
        className={`${h} rounded-full font-bold transition-colors ${dev ? 'bg-gradient-to-r from-[#7c3aed] to-[#2563eb] text-white shadow-sm' : 'text-[#9d9280] hover:text-[#4a4337]'}`}>🛠 개발 AI</button>
    </div>
  )
}
