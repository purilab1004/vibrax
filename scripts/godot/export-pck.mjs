// Godot 프로젝트 파일들 → 웹용 게임 데이터(.pck). 엔진(wasm)은 공용이라 게임마다 pck 만 만든다.
//   import { exportPck } from './godot/export-pck.mjs'  ·  exportPck(files) → Buffer
//   단독 실행: node scripts/godot/export-pck.mjs <프로젝트 폴더> <출력.pck>
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'

export const GODOT_BIN = process.env.GODOT_BIN
  || [path.join(os.homedir(), '.cache/vibrax-godot/Godot.app/Contents/MacOS/Godot'), '/Applications/Godot.app/Contents/MacOS/Godot'].find((f) => fs.existsSync(f))
  || 'godot'

const PRESET = `[preset.0]

name="Web"
platform="Web"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="out/index.html"

[preset.0.options]

custom_template/debug=""
custom_template/release=""
variant/extensions_support=false
variant/thread_support=false
vram_texture_compression/for_desktop=true
vram_texture_compression/for_mobile=false
html/export_icon=false
html/canvas_resize_policy=2
`
const run = (args, cwd, ms) => new Promise((ok) => execFile(GODOT_BIN, args, { cwd, timeout: ms, maxBuffer: 8 << 20 }, (err, stdout, stderr) => ok({ err, out: String(stdout) + String(stderr) })))

/** files: [{path, content}] → { pck: Buffer, log } (실패 시 Error) */
export async function exportPck(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vbx-godot-'))
  try {
    for (const f of files) { const p = path.join(dir, f.path); if (!p.startsWith(dir + path.sep)) continue; fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.content) }
    fs.writeFileSync(path.join(dir, 'export_presets.cfg'), PRESET)
    const imp = await run(['--headless', '--editor', '--quit', '--path', dir], dir, 180_000)   // 처음 가져오기(.godot/)
    const ex = await run(['--headless', '--path', dir, '--export-pack', 'Web', 'game.pck'], dir, 180_000)
    const pck = path.join(dir, 'game.pck')
    const errs = (imp.out + '\n' + ex.out).split('\n').filter((l) => /SCRIPT ERROR|Parse Error|ERROR:/.test(l) && !/export template|templates/i.test(l))
    if (!fs.existsSync(pck)) throw new Error('pck 를 만들지 못했어요: ' + (errs[0] || ex.out.slice(-300)))
    return { pck: fs.readFileSync(pck), errors: errs }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [src, out] = process.argv.slice(2)
  const walk = (d, b = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.name.startsWith('.') ? [] : e.isDirectory() ? walk(path.join(d, e.name), b) : [{ path: path.relative(b, path.join(d, e.name)), content: fs.readFileSync(path.join(d, e.name), 'utf8') }])
  const r = await exportPck(walk(src))
  fs.writeFileSync(out, r.pck); console.log('pck', r.pck.length, 'bytes', r.errors.length ? 'errors: ' + r.errors.join(' | ') : '')
}
