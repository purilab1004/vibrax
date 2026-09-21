// scripts/build-three-addons.mjs — 게임 샌드박스용 three.js addons 번들 만들기.
// 게임은 CSP 샌드박스라 우리 도메인 스크립트만 불러올 수 있다. /vendor/three.min.js 는 r149 '코어' 뿐이라
// GLTFLoader 같은 addons 가 없다 → 같은 r149 의 addons 를 전역 THREE 에 붙는 한 파일로 묶는다.
//   결과: public/vendor/three-addons.js   (GLTFLoader · DRACOLoader · OrbitControls · SkeletonUtils + THREE.loadGLB)
//   실행: node scripts/build-three-addons.mjs   (three@0.149 소스 필요 — SRC 경로)
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const SRC = process.env.THREE149 || '/private/tmp/claude-501/-Users-sungjunahn-Documents-vibrax/a7a7c90f-0c6d-42fe-aa78-88a6e9d14d6d/scratchpad/t149/package'
const OUT = 'public/vendor/three-addons.js'
const TMP = fs.mkdtempSync('/tmp/vbx-addons-')

// 1) addons 가 import 하는 'three' 를 전역 THREE 로 이어 주는 shim 을 만든다(코어를 또 넣지 않으려고)
const core = fs.readFileSync(path.join(SRC, 'build/three.module.js'), 'utf8')
const exportBlock = core.slice(core.lastIndexOf('export {'))
const names = [...exportBlock.matchAll(/(?:^|[{,\s])([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*(?=[,}])/g)]
  .map(m => (m[2] || m[1]).trim())
  .filter(n => n && n !== 'export')
const uniq = [...new Set(names)]
fs.writeFileSync(path.join(TMP, 'three-global.js'),
  `const T = globalThis.THREE || {};\nexport default T;\n` +
  uniq.map(n => `export const ${n} = T.${n};`).join('\n') + '\n')

// 2) 번들 진입점 — addons 를 THREE 에 붙이고, 게임에서 쓰기 쉬운 loadGLB 헬퍼도 추가
fs.writeFileSync(path.join(TMP, 'entry.js'), `
import { GLTFLoader } from '${SRC}/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from '${SRC}/examples/jsm/loaders/DRACOLoader.js'
import { OrbitControls } from '${SRC}/examples/jsm/controls/OrbitControls.js'
import * as SkeletonUtils from '${SRC}/examples/jsm/utils/SkeletonUtils.js'

const T = globalThis.THREE
if (!T) { console.error('[vibrex] three.min.js 를 먼저 불러와야 합니다') }
else {
  T.GLTFLoader = GLTFLoader
  T.DRACOLoader = DRACOLoader
  T.OrbitControls = OrbitControls
  T.SkeletonUtils = SkeletonUtils
  // 게임용 한 줄 로더 — 에셋 이름(미디어 라이브러리)이나 URL 을 주면 모델을 돌려준다
  T.loadGLB = function (nameOrUrl) {
    const src = (globalThis.VIBREX_ASSETS && globalThis.VIBREX_ASSETS[nameOrUrl]) || nameOrUrl
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader()
      try {
        const draco = new DRACOLoader()
        draco.setDecoderPath('https://vibrexcup.com/vendor/draco/')
        loader.setDRACOLoader(draco)
      } catch (e) { /* 드라코 없이도 동작 */ }
      loader.load(src, (gltf) => resolve(gltf), undefined, reject)
    })
  }
}
`)

execFileSync('node_modules/.bin/esbuild', [path.join(TMP, 'entry.js'), '--bundle', '--format=iife', '--minify',
  `--alias:three=${path.join(TMP, 'three-global.js')}`, `--outfile=${OUT}`], { stdio: 'inherit' })
fs.rmSync(TMP, { recursive: true, force: true })
console.log('✓', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB', '| 코어 export', uniq.length, '개 연결')
