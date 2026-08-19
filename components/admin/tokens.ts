// 관리자 UI 문자열 토큰 — 서버/클라이언트 컴포넌트 양쪽에서 안전하게 import ('use client' 경계 없음)
export const btn = {
  primary: 'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-[#2563eb] text-white text-[12.5px] font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors',
  ghost: 'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#d9dde5] bg-white text-[12.5px] font-medium text-[#1f2430] hover:bg-[#f3f5f8] hover:border-[#c5cad4] disabled:opacity-50 transition-colors',
  danger: 'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-[#dc2626] text-white text-[12.5px] font-semibold hover:bg-[#b91c1c] disabled:opacity-50 transition-colors',
  icon: 'inline-flex items-center justify-center w-8 h-8 rounded-md text-[#6b7280] hover:bg-[#f3f5f8] hover:text-[#1f2430] transition-colors',
}
export const input = 'w-full h-8 rounded-md border border-[#d9dde5] bg-white px-3 text-[13px] text-[#1f2430] placeholder-[#9aa1ad] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition'
export const label = 'block text-[11px] font-semibold text-[#6b7280] mb-1'
export const th = 'text-left text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280] px-3 py-2 bg-[#f7f8fa] border-b border-[#e3e6ec] whitespace-nowrap'
export const td = 'px-3 py-2 text-[12.5px] text-[#1f2430] align-middle'
export const trHover = 'hover:bg-[#f7f9fc] transition-colors'
