// lib/country.ts
// ISO 3166-1 alpha-2 country code → flag emoji (regional indicator letters).
export function countryFlag(code?: string | null): string {
  if (!code) return ''
  const cc = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(...[...cc].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}
