// 시청자수 표기 — kick 스타일 (1234 → 1.2K)
export function formatViewers(n: number): string {
  const fmt = (v: number, unit: string) => {
    const r = Math.round(v * 10) / 10
    return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}${unit}`
  }
  if (n >= 1_000_000) return fmt(n / 1_000_000, 'M')
  if (n >= 1_000) return fmt(n / 1_000, 'K')
  return String(n)
}
