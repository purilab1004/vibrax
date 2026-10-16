'use client'
// 일반 AI / 개발 AI / 디자이너 AI 모드 스위치 — 브라우저에 기억 (스튜디오 첫 화면·채팅 공용 키 vx_studio_mode)
// 디자이너 AI 는 별도 작업 공간(/studio/design)이라 고르면 그 화면으로 이동하고, 거기서 다른 모드를 고르면 스튜디오로 돌아온다.
import { useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export type StudioMode = 'normal' | 'dev' | 'designer'
const KEY = 'vx_studio_mode', EVT = 'vx-studio-mode'
const readMode = (): StudioMode => { try { const v = localStorage.getItem(KEY); return v === 'dev' || v === 'designer' ? v : 'normal' } catch { return 'normal' } }
const sub = (fn: () => void) => { window.addEventListener(EVT, fn); window.addEventListener('storage', fn); return () => { window.removeEventListener(EVT, fn); window.removeEventListener('storage', fn) } }
export function setStudioMode(m: StudioMode) { try { localStorage.setItem(KEY, m) } catch { /* 저장소 없음 */ } window.dispatchEvent(new Event(EVT)) }
/** @deprecated 개발 AI 여부 — setStudioMode 사용 */
export function setAiMode(dev: boolean) { setStudioMode(dev ? 'dev' : 'normal') }
export function useStudioMode(): StudioMode { return useSyncExternalStore(sub, readMode, () => 'normal') }
/** 개발 AI 모드인가 (게임 생성 화면에서 쓰는 값) */
export function useAiMode(): boolean { return useStudioMode() === 'dev' }

export default function AiModeToggle({ size = 'sm', tone = 'light' }: { size?: 'sm' | 'md'; tone?: 'light' | 'dark' }) {
  const stored = useStudioMode()
  const router = useRouter()
  const path = usePathname() ?? ''
  const inDesign = path.startsWith('/studio/design')
  const mode: StudioMode = inDesign ? 'designer' : stored === 'designer' ? 'normal' : stored
  const pick = (m: StudioMode) => {
    setStudioMode(m)
    if (m === 'designer' && !inDesign) router.push('/studio/design')
    else if (m !== 'designer' && inDesign) router.push('/studio')
  }
  const h = size === 'md' ? 'h-9 px-4 text-[13px]' : 'h-7 px-2.5 text-[11.5px]'
  const dark = tone === 'dark'
  const off = dark ? 'text-white/50 hover:text-white' : 'text-[#9d9280] hover:text-[#4a4337]'
  const opt = (m: StudioMode, label: string, title: string, on: string) => (
    <button type="button" role="radio" aria-checked={mode === m} onClick={() => pick(m)} title={title}
      className={`${h} rounded-full font-bold whitespace-nowrap transition-colors ${mode === m ? on : off}`}>{label}</button>
  )
  return (
    <div className={`inline-flex items-center rounded-full p-0.5 border ${dark ? 'bg-white/[0.06] border-white/10' : 'bg-[#f1ede4] border-[#e6dfd0]'}`} role="radiogroup" aria-label="AI 모드">
      {opt('normal', '일반 AI', '프롬프트만으로 바로 만들기', dark ? 'bg-white text-[#14121b] shadow-sm' : 'bg-white text-[#241f17] shadow-sm')}
      {opt('dev', '🛠 개발 AI', '2D/3D·엔진·그래픽·플레이·스토리·조작·난이도를 정하고 만들기', 'bg-gradient-to-r from-[#7c3aed] to-[#2563eb] text-white shadow-sm')}
      {opt('designer', '🎨 디자이너 AI', '이미지·3D 생성, 내 드라이브, 갤러리 검색 — 승인된 디자이너 작업 공간', 'bg-gradient-to-r from-[#ec4899] to-[#f59e0b] text-white shadow-sm')}
    </div>
  )
}
