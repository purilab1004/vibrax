// Paddle 웹훅 서명 검증 — 헤더 형식 "ts=<unix>;h1=<hex>",
// 서명 대상은 "<ts>:<rawBody>" (HMAC-SHA256, 웹훅 시크릿)
import { createHmac, timingSafeEqual } from 'node:crypto'

export function parsePaddleSignature(header: string): { ts: string; h1: string } | null {
  const parts: Record<string, string> = {}
  for (const kv of header.split(';')) {
    const idx = kv.indexOf('=')
    if (idx === -1) continue
    parts[kv.slice(0, idx)] = kv.slice(idx + 1)
  }
  if (!parts.ts || !parts.h1) return null
  return { ts: parts.ts, h1: parts.h1 }
}

export function verifyPaddleSignature(rawBody: string, header: string, secret: string): boolean {
  if (!secret) return false
  const parsed = parsePaddleSignature(header)
  if (!parsed) return false
  const expected = createHmac('sha256', secret).update(`${parsed.ts}:${rawBody}`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(parsed.h1)
  return a.length === b.length && timingSafeEqual(a, b)
}
