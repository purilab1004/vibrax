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

/** 숫자 축약 — 5,068 → 5.1K, 12,340 → 12K, 1,200,000 → 1.2M (공간이 좁은 배지용, 정확한 값은 툴팁으로) */
export function compactNum(n: number): string {
  if (n < 1000) return n.toLocaleString()
  if (n < 10_000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0).replace(/\.0$/, '')}K`
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
}
