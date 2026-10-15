// Godot 공식 export 템플릿(.tpz, 1GB+)에서 웹(스레드 없는) 엔진 파일만 HTTP Range 로 꺼낸다 → public/godot/<버전>/
//   node scripts/godot/fetch-web-engine.mjs 4.7.2
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const VER = process.argv[2] || '4.7.2'
const URL0 = `https://github.com/godotengine/godot/releases/download/${VER}-stable/Godot_v${VER}-stable_export_templates.tpz`
const OUT = path.resolve(process.argv[3] || `public/godot/${VER}`)

async function finalUrl(u) { const r = await fetch(u, { method: 'HEAD', redirect: 'follow' }); return { url: r.url, size: Number(r.headers.get('content-length')) } }
async function range(url, a, b) {
  const r = await fetch(url, { headers: { Range: `bytes=${a}-${b}` } })
  if (r.status !== 206) throw new Error('range 미지원 ' + r.status)
  return Buffer.from(await r.arrayBuffer())
}
// zip 중앙 디렉터리 읽기 (zip64 포함)
async function listZip(url, size, readAt) {
  const tail = await readAt(Math.max(0, size - 65557), size - 1)
  let eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw new Error('EOCD 없음')
  let cdSize = tail.readUInt32LE(eocd + 12), cdOff = tail.readUInt32LE(eocd + 16), n = tail.readUInt16LE(eocd + 10)
  const z64 = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]))
  if (z64 >= 0 && (cdOff === 0xffffffff || n === 0xffff)) {
    const recOff = Number(tail.readBigUInt64LE(z64 + 8)), rec = await readAt(recOff, recOff + 55)
    n = Number(rec.readBigUInt64LE(32)); cdSize = Number(rec.readBigUInt64LE(40)); cdOff = Number(rec.readBigUInt64LE(48))
  }
  const cd = await readAt(cdOff, cdOff + cdSize - 1)
  const entries = []
  for (let p = 0, i = 0; i < n; i++) {
    const method = cd.readUInt16LE(p + 10), csize0 = cd.readUInt32LE(p + 20), usize0 = cd.readUInt32LE(p + 24)
    const nl = cd.readUInt16LE(p + 28), el = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32)
    let off = cd.readUInt32LE(p + 42), csize = csize0, usize = usize0
    const name = cd.toString('utf8', p + 46, p + 46 + nl)
    // zip64 확장 필드
    let x = p + 46 + nl; const xe = x + el
    while (x < xe) { const id = cd.readUInt16LE(x), sz = cd.readUInt16LE(x + 2); if (id === 1) { let q = x + 4; if (usize0 === 0xffffffff) { usize = Number(cd.readBigUInt64LE(q)); q += 8 } if (csize0 === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8 } if (off === 0xffffffff) { off = Number(cd.readBigUInt64LE(q)) } } x += 4 + sz }
    entries.push({ name, method, csize, usize, off })
    p += 46 + nl + el + cl
  }
  return entries
}
async function readEntry(e, readAt) {
  const lh = await readAt(e.off, e.off + 29)
  const start = e.off + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28)
  const data = await readAt(start, start + e.csize - 1)
  return e.method === 0 ? data : zlib.inflateRawSync(data)
}

const { url, size } = await finalUrl(URL0)
console.log('tpz', (size / 1048576).toFixed(0) + 'MB')
const outer = await listZip(url, size, (a, b) => range(url, a, b))
const inner = outer.find((e) => /web_nothreads_release\.zip$/.test(e.name))
if (!inner) throw new Error('web_nothreads_release.zip 없음: ' + outer.map((e) => e.name).filter((n) => /web/.test(n)).join(', '))
console.log('inner', inner.name, (inner.csize / 1048576).toFixed(1) + 'MB', 'method', inner.method)
const innerBuf = await readEntry(inner, (a, b) => range(url, a, b))
const files = await listZip(null, innerBuf.length, async (a, b) => innerBuf.subarray(a, b + 1))
fs.mkdirSync(OUT, { recursive: true })
for (const e of files) {
  if (e.name.endsWith('/')) continue
  const base = path.basename(e.name)
  if (!/\.(js|wasm)$/.test(base) || /\.html$/.test(base)) continue
  const buf = await readEntry(e, async (a, b) => innerBuf.subarray(a, b + 1))
  const name = base.replace(/^godot(\.web\.template_release\.wasm32\.nothreads)?/, 'godot')
  fs.writeFileSync(path.join(OUT, name), buf)
  console.log(' ', base, '→', name, (buf.length / 1048576).toFixed(2) + 'MB')
}
