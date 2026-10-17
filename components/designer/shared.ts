// 디자이너 작업 공간 공용 타입·스타일
export interface DriveFile { key: string; name: string; url: string; thumb: string | null; size: number; mime: string; created_at: string | null; rig?: 'face' | 'anim' | 'bones' | 'none' | null }
/** 3D 모델 뼈대 배지 */
export const rigBadge = (rig?: string | null) => rig === 'face' ? '🦴 움직임 · 😀 표정' : rig === 'anim' ? '🦴 움직임' : rig === 'bones' ? '🦴 뼈대' : null
/** 3D 생성으로 넘기는 원본 */
export type Source3D = { kind: 'drive'; key: string; url: string; name: string } | { kind: 'media'; id: string; url: string; title: string }
export type Section = 'drive' | 'image' | 'model3d' | 'search' | 'works'

export const ui = {
  card: 'rounded-2xl bg-white border border-[#ebe4d6] shadow-[0_1px_2px_rgba(36,31,23,0.04)]',
  input: 'w-full h-11 rounded-xl bg-white border border-[#ddd3bf] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 px-3.5 text-[13.5px] text-[#241f17] outline-none placeholder:text-[#b3a993] transition',
  primary: 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13px] font-bold disabled:opacity-40 transition-colors',
  ghost: 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-white border border-[#ddd3bf] hover:bg-[#faf8f3] text-[#4a4337] text-[13px] font-semibold disabled:opacity-40 transition-colors',
  chip: (on: boolean) => `shrink-0 h-8 px-3 rounded-full text-[12.5px] font-bold border transition-colors ${on ? 'bg-[#241f17] border-[#241f17] text-white' : 'bg-white border-[#e6dfd0] text-[#6b6152] hover:border-[#cfc4ab]'}`,
  checker: 'bg-[repeating-conic-gradient(#f3f0e8_0_25%,#fff_0_50%)] bg-[length:14px_14px]',
}
export const isImage = (name: string) => /\.(png|jpe?g|webp|gif)$/i.test(name)
export const isGlb = (name: string) => /\.glb$/i.test(name)
export const isAudio = (name: string) => /\.(mp3|wav|ogg|m4a)$/i.test(name)
export const fmtSize = (b: number) => (b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB')
