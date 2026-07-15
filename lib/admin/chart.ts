// SVG polyline points 생성 — 값들을 (width×height) 좌표계로 투영
export function linePoints(values: number[], width: number, height: number, pad = 2): string {
  if (values.length === 0) return ''
  const max = Math.max(...values, 1)
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
  return values
    .map((v, i) => {
      const x = pad + i * stepX
      const y = height - pad - (v / max) * (height - pad * 2)
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
    })
    .join(' ')
}
