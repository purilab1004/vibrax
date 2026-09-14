import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { optimizeImage } from './optimize'

test('optimizeImage — 큰 사진 PNG 는 손실 WebP 로 작아진다', async () => {
  const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 30, g: 120, b: 200 } } }).composite([{ input: Buffer.from(`<svg width="900" height="600"><circle cx="450" cy="300" r="200" fill="#f59e0b"/><rect x="50" y="50" width="300" height="200" fill="#10b981"/></svg>`), top: 0, left: 0 }]).png().toBuffer()
  const o = await optimizeImage(png, 'image/png')
  assert.equal(o.mime, 'image/webp'); assert.ok(o.converted); assert.ok(o.buf.length < png.length); assert.equal(o.width, 900)
})
test('optimizeImage — 작은 투명 픽셀아트는 무손실 WebP, 알파 유지', async () => {
  const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0 } } }).composite([{ input: Buffer.from('<svg width="32" height="32"><rect x="8" y="8" width="16" height="16" fill="#00f"/></svg>'), top: 0, left: 0 }]).png().toBuffer()
  const o = await optimizeImage(png, 'image/png')
  const m = await sharp(o.buf).metadata()
  assert.equal(m.hasAlpha, true); assert.equal(o.width, 32)
})
test('optimizeImage — 2048 초과는 축소', async () => {
  const jpg = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#888' } }).jpeg().toBuffer()
  const o = await optimizeImage(jpg, 'image/jpeg')
  assert.equal(o.width, 2048); assert.equal(o.height, 1024); assert.equal(o.mime, 'image/webp')
})
test('optimizeImage — svg/오디오는 그대로', async () => {
  const b = Buffer.from('<svg/>'); const o = await optimizeImage(b, 'image/svg+xml')
  assert.equal(o.converted, false); assert.equal(o.buf, b)
})
