import type { Genre } from '@/lib/supabase/types'

// 타이틀 기반 자동 썸네일 — Canvas로 브랜드 스타일(다크+네온) 1280×720 PNG 생성.
// 같은 타이틀+시드는 항상 같은 결과(결정적). 시드를 바꾸면 다른 배색/배치가 나온다.

const PALETTES: [string, string][] = [
  ['#00ff41', '#ffd24d'],
  ['#00e5ff', '#ff2d95'],
  ['#ff6b35', '#ffd24d'],
  ['#a78bfa', '#00ff41'],
  ['#ff2d95', '#00e5ff'],
  ['#4ade80', '#60a5fa'],
  ['#f97316', '#22d3ee'],
]

const GENRE_LABEL: Record<Genre, string> = {
  action: 'ACTION', adventure: 'ADVENTURE', strategy: 'STRATEGY', sports: 'SPORTS',
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pixelFontStack(): string {
  if (typeof document === 'undefined') return 'monospace'
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-pixel').trim()
  return v || 'monospace'
}

// 제목을 캔버스 폭에 맞게 최대 2줄로 줄바꿈 (한국어처럼 공백 없는 문자열도 처리)
function wrapTitle(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  const push = () => { if (current) { lines.push(current); current = '' } }
  const units = text.includes(' ') ? text.split(' ') : Array.from(text)
  const joiner = text.includes(' ') ? ' ' : ''
  for (const u of units) {
    const candidate = current ? current + joiner + u : u
    if (ctx.measureText(candidate).width > maxWidth && current) {
      push()
      current = u
    } else {
      current = candidate
    }
    if (lines.length === 2) break
  }
  push()
  if (lines.length > 2) {
    lines.length = 2
    lines[1] = lines[1].slice(0, -1) + '…'
  }
  return lines
}

export async function generateThumbnail(title: string, genre: Genre, seed = 0): Promise<Blob> {
  const W = 1280
  const H = 720
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const rng = mulberry32(hashStr(`${title}|${genre}`) + seed * 7919)
  const [c1, c2] = PALETTES[Math.floor(rng() * PALETTES.length)]
  const pixel = pixelFontStack()

  try { await document.fonts?.ready } catch { /* 폰트 로드 실패해도 진행 */ }

  // 배경 그라데이션
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0e1015')
  bg.addColorStop(1, '#05070a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 네온 글로우 2개
  for (const [color, cx, cy] of [
    [c1, W * (0.15 + rng() * 0.25), H * (0.2 + rng() * 0.3)],
    [c2, W * (0.6 + rng() * 0.3), H * (0.55 + rng() * 0.35)],
  ] as [string, number, number][]) {
    const r = 260 + rng() * 220
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, color + '38')
    g.addColorStop(1, color + '00')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  // 픽셀 그리드
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // 흩뿌린 픽셀 블록 (중앙 제목 영역 회피)
  for (let i = 0; i < 16; i++) {
    const size = 8 + rng() * 26
    const x = rng() * (W - size)
    const y = rng() * (H - size)
    if (y > H * 0.3 && y < H * 0.68 && x > W * 0.12 && x < W * 0.88) continue
    ctx.fillStyle = (rng() > 0.5 ? c1 : c2) + (rng() > 0.5 ? 'cc' : '77')
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size))
  }

  // 장르 라벨 (좌상단)
  ctx.fillStyle = c1
  ctx.font = `16px ${pixel}`
  ctx.textBaseline = 'top'
  ctx.fillText(`▮ ${GENRE_LABEL[genre]}`, 56, 52)

  // 제목 (중앙, 최대 2줄, 길이에 따라 크기 조절)
  const base = title.length <= 8 ? 96 : title.length <= 16 ? 76 : 60
  ctx.font = `800 ${base}px 'Pretendard Variable', Pretendard, sans-serif`
  const lines = wrapTitle(ctx, title.trim() || 'MY GAME', W - 220)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = c1
  ctx.shadowBlur = 34
  ctx.fillStyle = '#ffffff'
  const lineH = base * 1.22
  const startY = H / 2 - ((lines.length - 1) * lineH) / 2
  lines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * lineH))
  ctx.shadowBlur = 0

  // 제목 아래 액센트 언더라인
  const uw = 120 + rng() * 80
  ctx.fillStyle = c2
  ctx.fillRect(W / 2 - uw / 2, startY + (lines.length - 0.5) * lineH + 18, uw, 8)

  // 워터마크 (우하단)
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `20px ${pixel}`
  ctx.fillStyle = c1
  const cupW = ctx.measureText('CUP').width
  ctx.fillText('VIBREX', W - 56 - cupW, H - 48)
  ctx.fillStyle = c2
  ctx.fillText('CUP', W - 56, H - 48)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}
