// lib/country.ts
// ISO 3166-1 alpha-2 country code → flag emoji (regional indicator letters).
export function countryFlag(code?: string | null): string {
  if (!code) return ''
  const cc = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(...[...cc].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}

// 국기 대표색 — 아바타 링(회전 테두리)을 국기 색으로 물들일 때 사용
export const FLAG_COLORS: Record<string, string[]> = {
  KR: ['#cd2e3a', '#ffffff', '#0047a0'], US: ['#b22234', '#ffffff', '#3c3b6e'], JP: ['#bc002d', '#ffffff'], CN: ['#de2910', '#ffde00'], TW: ['#fe0000', '#000095', '#ffffff'], HK: ['#de2910', '#ffffff'],
  GB: ['#c8102e', '#ffffff', '#012169'], DE: ['#000000', '#dd0000', '#ffce00'], FR: ['#0055a4', '#ffffff', '#ef4135'], ES: ['#aa151b', '#f1bf00'], IT: ['#009246', '#ffffff', '#ce2b37'], NL: ['#ae1c28', '#ffffff', '#21468b'],
  CA: ['#ff0000', '#ffffff'], AU: ['#012169', '#ffffff', '#e4002b'], BR: ['#009c3b', '#ffdf00', '#002776'], MX: ['#006847', '#ffffff', '#ce1126'], IN: ['#ff9933', '#ffffff', '#138808'], ID: ['#ce1126', '#ffffff'],
  VN: ['#da251d', '#ffff00'], TH: ['#a51931', '#ffffff', '#2d2a4a'], PH: ['#0038a8', '#ce1126', '#fcd116'], SG: ['#ef3340', '#ffffff'], TR: ['#e30a17', '#ffffff'], RU: ['#ffffff', '#0039a6', '#d52b1e'],
}
/** 국기 색 conic-gradient 문자열 (없으면 null → 기본 파랑/흰) */
export function flagRingGradient(code?: string | null): string | null {
  const c = code ? FLAG_COLORS[code.toUpperCase()] : undefined
  if (!c) return null
  const n = c.length
  const stops = c.map((col, i) => `${col} ${Math.round((i / n) * 360)}deg ${Math.round(((i + 1) / n) * 360)}deg`).join(', ')
  return `conic-gradient(from 0deg, ${stops})`
}
export const flagRingStyle = (code?: string | null): React.CSSProperties | undefined => { const g = flagRingGradient(code); return g ? ({ ['--ring' as string]: g } as React.CSSProperties) : undefined }
