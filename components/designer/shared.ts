// 디자이너 작업 공간 공용 타입·스타일
export interface DriveFile { key: string; name: string; url: string; thumb: string | null; size: number; mime: string; created_at: string | null; rig?: 'face' | 'anim' | 'bones' | 'none' | null }
/** 3D 모델 뼈대 배지 */
export const rigBadge = (rig?: string | null) => rig === 'face' ? '움직임 · 표정' : rig === 'anim' ? '움직임' : rig === 'bones' ? '뼈대' : null
/** 3D 생성으로 넘기는 원본 */
export type Source3D = ({ kind: 'drive'; key: string; url: string; name: string } | { kind: 'media'; id: string; url: string; title: string }) & { body?: 'biped' | 'quad' | 'prop' }
export type Section = 'drive' | 'image' | 'model3d' | 'search' | 'works'

export const ui = {
  card: 'rounded-[4px] bg-white/65 backdrop-blur-xl border border-white/80 shadow-[0_10px_40px_-18px_rgba(37,99,235,0.35)]',
  input: 'w-full h-11 rounded-[4px] bg-white/80 border border-[#dde3ee] focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 px-3.5 text-[13.5px] text-[#1f2937] outline-none placeholder:text-[#a8b0c0] transition',
  primary: 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[4px] bg-gradient-to-r from-[#2563eb] to-[#38bdf8] hover:brightness-110 text-white text-[13px] font-bold shadow-[0_8px_22px_-10px_rgba(37,99,235,0.8)] disabled:opacity-40 transition',
  ghost: 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[4px] bg-white/70 border border-[#dde3ee] hover:bg-white text-[#374151] text-[13px] font-semibold disabled:opacity-40 transition-colors',
  chip: (on: boolean) => `shrink-0 h-8 px-3 rounded-[4px] text-[12.5px] font-bold border transition-all ${on ? 'bg-gradient-to-r from-[#2563eb] to-[#38bdf8] border-transparent text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.8)]' : 'bg-white/70 border-[#dde3ee] text-[#4b5563] hover:border-[#93c5fd]'}`,
  checker: 'bg-[repeating-conic-gradient(#f1f4f9_0_25%,#fff_0_50%)] bg-[length:14px_14px]',
}
export const isImage = (name: string) => /\.(png|jpe?g|webp|gif)$/i.test(name)
export const isGlb = (name: string) => /\.glb$/i.test(name)
export const isAudio = (name: string) => /\.(mp3|wav|ogg|m4a)$/i.test(name)
export const fmtSize = (b: number) => (b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB')
