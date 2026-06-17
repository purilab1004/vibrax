# Avatar Composer BJ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users build a personal VRM avatar in an in-app editor and have that avatar broadcast as the BJ in any game they create.

**Architecture:** Reuse `avatar-composer-main`'s framework-agnostic engine (`partLoader.ts`, `constants.ts` — pure three.js / three-vrm, no R3F) inside a vanilla-three imperative `AvatarEngine` class mounted via `useEffect`, exactly like the existing `AvatarOverlay` mounts TalkingHead. The editor and the in-game BJ both mount this engine. The avatar is never baked to GLB — only a small selection JSON is persisted to `profiles.avatar_config` and re-assembled live in the browser.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4, `three` ~0.170, `@pixiv/three-vrm` ~3.5, Supabase (auth + `profiles` table + `avatars` storage bucket), Google TTS (existing).

## Global Constraints

- **No R3F / React-Three-Fiber.** Engine is vanilla three.js in imperative classes. (R3F v8 ≠ React 19.)
- **Pin deps to the composer's working set:** `three@^0.170.0`, `@pixiv/three-vrm@^3.5.3`, `@types/three@^0.170.0`. Do not upgrade three past 0.170.x.
- **No GLB baking / download.** Persist only the selection JSON. Re-assemble at runtime.
- **Avatar config lives on `profiles.avatar_config` (jsonb), NOT `user_metadata`** — the BJ path reads another user's (the game creator's) config via normal SELECT.
- **Part files are shared static assets** under `public/avatars/composer/`. No S3 for parts.
- **Config JSON shape (version 1):**
  ```json
  { "selection": { "tops": "tops-basic"|null, "bottoms": "bottoms-jean"|null,
                   "hair": "hair-sample"|null, "face": "face-eyesample"|null },
    "eyeColor": "#5b3a29"|null, "previewUrl": "https://..."|null, "version": 1 }
  ```
- **Existing speech path is unchanged:** a `window` `avatar:speak` CustomEvent carries `{ text }`; the renderer fetches Google TTS and drives lip-sync. Do not change the event contract.
- **Styling matches vibrax:** pixel font (`font-pixel`), neon green `#00ff41`, purple accents, dark `#0a0a0a`/`#0d0d0d` panels.
- **Verification gates** (this repo has no test framework): every task ends with `npx tsc --noEmit` clean + `npm run lint` clean. Pure-logic tasks add `node --test --experimental-strip-types <file>` tests. Visual/3D tasks add an explicit `npm run dev` browser-observation step with stated expected behavior.

---

## File Structure

| Path | Responsibility |
|---|---|
| `public/avatars/composer/**` | Shared static VRM/GLB parts + thumbnails (asset build output) |
| `lib/avatar/catalog.ts` | Parts catalog, `Selection` type, derived indexes, default selection, base URL |
| `lib/avatar/partLoader.ts` | `loadPart`/`loadSpringPart`/`loadFacePart` (ported verbatim from composer) |
| `lib/avatar/engine.ts` | `AvatarEngine` — vanilla three scene, base VRM, slot swap, idle loop, toon pass, eye color, expression, TTS viseme driver |
| `lib/avatar/config.ts` | `AvatarConfig` type + `validateConfig`/`normalizeSelection` pure helpers |
| `lib/avatar/storage.ts` | Supabase read/write of `profiles.avatar_config` (+ optional preview upload) |
| `lib/avatar/visemes.ts` | Pure `buildVisemeTrack(words, wtimes, wdurations)` timing math |
| `lib/supabase/types.ts` | (modify) add `avatar_config` to `Profile` + `profiles` Update type |
| `app/avatar/page.tsx` | Editor page: engine canvas + catalog picker + save |
| `components/avatar/CatalogPicker.tsx` | Tabbed parts picker UI (vibrax-styled) |
| `components/avatar/AvatarStage.tsx` | Client wrapper that mounts `AvatarEngine` for the editor (ssr:false) |
| `components/CustomAvatarOverlay.tsx` | In-game BJ renderer (engine + `avatar:speak` + visemes) |
| `components/AiBjPanel.tsx` | (modify) pick `CustomAvatarOverlay` vs `AvatarOverlay` by creator config |
| `components/GamePlayButton.tsx` | (modify) fetch game creator's `avatar_config`, pass down |
| `db/migrations/2026-06-17-avatar-config.sql` | `ALTER TABLE profiles ADD COLUMN avatar_config jsonb` |

---

## Phase 1 — Engine + Assets

### Task 1: Build and import composer assets, add deps

**Files:**
- Create: `public/avatars/composer/male_base.vrm` and the generated part files + thumbs (copied)
- Modify: `package.json` (deps)

**Interfaces:**
- Produces: static assets reachable at `/avatars/composer/male_base.vrm`,
  `/avatars/composer/male1/Tops_white_shirt.glb`, `/avatars/composer/male1/Tops_basic.glb`,
  `/avatars/composer/male1/Tops_hawaian.glb`, `/avatars/composer/male1/Bottoms_scotch_pants.glb`,
  `/avatars/composer/male1/Bottoms_jean.glb`, `/avatars/composer/male1/Bottoms_white_pants.glb`,
  `/avatars/composer/Hair_sample.vrm`, `/avatars/composer/male1/Face_eyesample.vrm`,
  `/avatars/composer/thumbs/<id>.png`.

- [ ] **Step 1: Install composer deps and run the asset build**

```bash
cd /Users/sungjunahn/Documents/avatar-composer-main
npm install
npm run assets   # extractParts.mjs (+ renderThumbs.mjs) → generates GLB/VRM parts under public/avatars
```
Expected: `public/avatars/male1/Tops_white_shirt.glb` (and the other 5 GLBs), `public/avatars/Hair_sample.vrm`, `public/avatars/male1/Face_eyesample.vrm` now exist.

- [ ] **Step 2: Copy artifacts into vibrax**

```bash
cd /Users/sungjunahn/Documents/vibrax
mkdir -p public/avatars/composer/male1 public/avatars/composer/thumbs
SRC=/Users/sungjunahn/Documents/avatar-composer-main/public/avatars
cp "$SRC/male_base.vrm"                 public/avatars/composer/
cp "$SRC/Hair_sample.vrm"               public/avatars/composer/
cp "$SRC/male1/Tops_white_shirt.glb"    public/avatars/composer/male1/
cp "$SRC/male1/Tops_basic.glb"          public/avatars/composer/male1/
cp "$SRC/male1/Tops_hawaian.glb"        public/avatars/composer/male1/
cp "$SRC/male1/Bottoms_scotch_pants.glb" public/avatars/composer/male1/
cp "$SRC/male1/Bottoms_jean.glb"        public/avatars/composer/male1/
cp "$SRC/male1/Bottoms_white_pants.glb" public/avatars/composer/male1/
cp "$SRC/male1/Face_eyesample.vrm"      public/avatars/composer/male1/
cp "$SRC"/thumbs/*.png                  public/avatars/composer/thumbs/
```

- [ ] **Step 3: Verify all expected files copied**

```bash
ls -1 public/avatars/composer public/avatars/composer/male1 public/avatars/composer/thumbs
```
Expected: `male_base.vrm`, `Hair_sample.vrm`; 6 `.glb` + `Face_eyesample.vrm` in `male1/`; 8 `.png` in `thumbs/`.

- [ ] **Step 4: Add runtime deps (pinned)**

```bash
npm install three@^0.170.0 @pixiv/three-vrm@^3.5.3
npm install -D @types/three@^0.170.0
```
Expected: `node_modules/three` and `node_modules/@pixiv/three-vrm` present.

- [ ] **Step 5: Verify serving + typecheck**

```bash
npm run dev &   # then in another shell:
curl -sI http://localhost:3000/avatars/composer/male_base.vrm | head -1
curl -sI http://localhost:3000/avatars/composer/male1/Tops_basic.glb | head -1
npx tsc --noEmit
```
Expected: both `HTTP/1.1 200 OK`; tsc clean. (Stop the dev server after.)

- [ ] **Step 6: Commit**

```bash
git add public/avatars/composer package.json package-lock.json
git commit -m "feat(avatar): import composer base+parts assets and add three/three-vrm deps"
```

---

### Task 2: Port the parts catalog

**Files:**
- Create: `lib/avatar/catalog.ts`
- Test: `lib/avatar/catalog.test.ts`

**Interfaces:**
- Produces:
  - `BASE_URL: string` = `'/avatars/composer/male_base.vrm'`
  - types `PartStatus`, `PartKind`, `PartCategory` (`'face'|'hair'|'tops'|'bottoms'`), `PartVariant`, `PartCategoryDef`, `ResolvedVariant`, `Selection` (`Record<PartCategory, string|null>`)
  - `CATALOG: PartCategoryDef[]`
  - `VARIANTS_BY_ID: Map<string, ResolvedVariant>`
  - `defaultSelection(): Selection`

- [ ] **Step 1: Write the failing test**

```ts
// lib/avatar/catalog.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATALOG, VARIANTS_BY_ID, defaultSelection, BASE_URL } from './catalog.ts'

test('base url points at composer namespace', () => {
  assert.equal(BASE_URL, '/avatars/composer/male_base.vrm')
})

test('every variant url is under /avatars/composer/', () => {
  for (const cat of CATALOG)
    for (const v of cat.variants)
      assert.ok(v.url.startsWith('/avatars/composer/'), `${v.id} -> ${v.url}`)
})

test('VARIANTS_BY_ID resolves a known variant to its category', () => {
  const r = VARIANTS_BY_ID.get('tops-basic')
  assert.equal(r?.categoryId, 'tops')
  assert.equal(r?.kind, 'static')
})

test('defaultSelection picks first variant per category', () => {
  const sel = defaultSelection()
  assert.equal(sel.tops, 'tops-white-shirt')
  assert.equal(sel.hair, 'hair-sample')
  assert.ok('face' in sel && 'bottoms' in sel)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/avatar/catalog.test.ts`
Expected: FAIL — cannot find module `./catalog.ts`.

- [ ] **Step 3: Write the catalog**

```ts
// lib/avatar/catalog.ts
// Ported from avatar-composer-main/src/composer/constants.ts.
// URLs rebased to /avatars/composer/. Engine convention lock lives in the composer repo.
export const BASE_URL = '/avatars/composer/male_base.vrm'

export type PartStatus = 'idle' | 'loading' | 'loaded' | 'missing' | 'error'
export type PartKind = 'static' | 'spring' | 'face'
export type PartCategory = 'face' | 'hair' | 'tops' | 'bottoms'

export interface PartVariant { id: string; label: string; url: string; thumb: string }
export interface PartCategoryDef {
  id: PartCategory; label: string; kind: PartKind; allowNone: boolean; variants: PartVariant[]
}

const thumb = (id: string) => `/avatars/composer/thumbs/${id}.png`

export const CATALOG: PartCategoryDef[] = [
  {
    id: 'face', label: '얼굴', kind: 'face', allowNone: true,
    variants: [
      { id: 'face-eyesample', label: '눈 변형', url: '/avatars/composer/male1/Face_eyesample.vrm', thumb: thumb('face-eyesample') },
    ],
  },
  {
    id: 'hair', label: '헤어', kind: 'spring', allowNone: true,
    variants: [
      { id: 'hair-sample', label: '기본 헤어', url: '/avatars/composer/Hair_sample.vrm', thumb: thumb('hair-sample') },
    ],
  },
  {
    id: 'tops', label: '상의', kind: 'static', allowNone: true,
    variants: [
      { id: 'tops-white-shirt', label: '화이트 셔츠', url: '/avatars/composer/male1/Tops_white_shirt.glb', thumb: thumb('tops-white-shirt') },
      { id: 'tops-basic',       label: '베이직 티',   url: '/avatars/composer/male1/Tops_basic.glb',       thumb: thumb('tops-basic') },
      { id: 'tops-hawaian',     label: '하와이안',    url: '/avatars/composer/male1/Tops_hawaian.glb',     thumb: thumb('tops-hawaian') },
    ],
  },
  {
    id: 'bottoms', label: '하의', kind: 'static', allowNone: true,
    variants: [
      { id: 'bottoms-scotch-pants', label: '스카치 팬츠', url: '/avatars/composer/male1/Bottoms_scotch_pants.glb', thumb: thumb('bottoms-scotch-pants') },
      { id: 'bottoms-jean',         label: '청바지',     url: '/avatars/composer/male1/Bottoms_jean.glb',         thumb: thumb('bottoms-jean') },
      { id: 'bottoms-white-pants',  label: '화이트 팬츠', url: '/avatars/composer/male1/Bottoms_white_pants.glb',  thumb: thumb('bottoms-white-pants') },
    ],
  },
]

export interface ResolvedVariant { categoryId: PartCategory; kind: PartKind; variant: PartVariant }

export const VARIANTS_BY_ID: Map<string, ResolvedVariant> = new Map(
  CATALOG.flatMap((c) => c.variants.map((variant) => [variant.id, { categoryId: c.id, kind: c.kind, variant }] as const)),
)

export type Selection = Record<PartCategory, string | null>

export const defaultSelection = (): Selection =>
  Object.fromEntries(CATALOG.map((c) => [c.id, c.variants[0]?.id ?? null])) as Selection
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/avatar/catalog.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/avatar/catalog.ts lib/avatar/catalog.test.ts
git commit -m "feat(avatar): port parts catalog with composer-namespaced asset urls"
```

---

### Task 3: Port the part loader (verbatim)

**Files:**
- Create: `lib/avatar/partLoader.ts`

**Interfaces:**
- Produces: `loadPart(url, baseVrm)`, `loadSpringPart(url, baseVrm)`, `loadFacePart(url, baseVrm)` and the result interfaces `LoadedPart`, `LoadedSpringPart`, `LoadedFacePart`. Each result has `dispose()`, `setVisible(v)`, `missingBones: string[]`; `LoadedFacePart` additionally has `sync()` and `setEyeColor(hex)`.

- [ ] **Step 1: Copy the file verbatim**

Copy `/Users/sungjunahn/Documents/avatar-composer-main/src/composer/partLoader.ts` to `lib/avatar/partLoader.ts` with **no logic changes**. It already imports only `@pixiv/three-vrm`, `three`, and `three/examples/jsm/loaders/GLTFLoader.js` — all available. Do not alter it.

```bash
cp /Users/sungjunahn/Documents/avatar-composer-main/src/composer/partLoader.ts lib/avatar/partLoader.ts
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (If `three/examples/jsm/...` types complain, confirm `@types/three` is installed from Task 1; it ships these types.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean (the file already carries the needed `eslint-disable` comments).

- [ ] **Step 4: Commit**

```bash
git add lib/avatar/partLoader.ts
git commit -m "feat(avatar): port composer partLoader verbatim (loadPart/spring/face)"
```

---

### Task 4: Viseme timing math (pure)

**Files:**
- Create: `lib/avatar/visemes.ts`
- Test: `lib/avatar/visemes.test.ts`

**Interfaces:**
- Produces:
  - `interface VisemeKey { t: number; value: number }` (t in ms from speech start; value 0..1 for the `aa` expression)
  - `buildVisemeTrack(words: string[], wtimes: number[], wdurations: number[]): VisemeKey[]` — for each word, emits an open keyframe at `wtimes[i] + dur*0.2` (value ~0.7) and a close keyframe at `wtimes[i] + dur` (value 0); track ends with a final 0 key. Sorted ascending by `t`.
  - `sampleViseme(track: VisemeKey[], tMs: number): number` — linear interpolation; clamps before first / after last key.

- [ ] **Step 1: Write the failing test**

```ts
// lib/avatar/visemes.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVisemeTrack, sampleViseme } from './visemes.ts'

test('builds open+close keys per word, sorted', () => {
  const track = buildVisemeTrack(['hi', 'yo'], [0, 100], [100, 100])
  for (let i = 1; i < track.length; i++) assert.ok(track[i].t >= track[i - 1].t)
  assert.ok(track.some((k) => k.value > 0.5))           // mouth opens
  assert.equal(track[track.length - 1].value, 0)        // ends closed
})

test('empty input yields a single closed key', () => {
  const track = buildVisemeTrack([], [], [])
  assert.deepEqual(track, [{ t: 0, value: 0 }])
})

test('sampleViseme interpolates and clamps', () => {
  const track = [{ t: 0, value: 0 }, { t: 100, value: 1 }]
  assert.equal(sampleViseme(track, -10), 0)
  assert.equal(sampleViseme(track, 50), 0.5)
  assert.equal(sampleViseme(track, 999), 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/avatar/visemes.test.ts`
Expected: FAIL — cannot find module `./visemes.ts`.

- [ ] **Step 3: Implement**

```ts
// lib/avatar/visemes.ts
// Pure timing math: turn TTS per-word timings into an `aa` expression track for a talking mouth.
export interface VisemeKey { t: number; value: number }

const OPEN = 0.7

export function buildVisemeTrack(words: string[], wtimes: number[], wdurations: number[]): VisemeKey[] {
  if (words.length === 0) return [{ t: 0, value: 0 }]
  const keys: VisemeKey[] = []
  for (let i = 0; i < words.length; i++) {
    const start = wtimes[i] ?? 0
    const dur = wdurations[i] ?? 0
    keys.push({ t: start + dur * 0.2, value: OPEN })
    keys.push({ t: start + dur, value: 0 })
  }
  keys.sort((a, b) => a.t - b.t)
  if (keys[keys.length - 1].value !== 0) keys.push({ t: keys[keys.length - 1].t + 1, value: 0 })
  return keys
}

export function sampleViseme(track: VisemeKey[], tMs: number): number {
  if (track.length === 0) return 0
  if (tMs <= track[0].t) return track[0].value
  if (tMs >= track[track.length - 1].t) return track[track.length - 1].value
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1], b = track[i]
    if (tMs <= b.t) {
      const span = b.t - a.t || 1
      const f = (tMs - a.t) / span
      return a.value + (b.value - a.value) * f
    }
  }
  return 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/avatar/visemes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/avatar/visemes.ts lib/avatar/visemes.test.ts
git commit -m "feat(avatar): viseme timing track from TTS word timings"
```

---

### Task 5: AvatarEngine (vanilla three render engine)

**Files:**
- Create: `lib/avatar/engine.ts`

**Interfaces:**
- Consumes: `BASE_URL`, `CATALOG`, `PartCategory`, `Selection`, `VARIANTS_BY_ID` (Task 2); `loadPart`/`loadSpringPart`/`loadFacePart`, `LoadedFacePart` (Task 3); `buildVisemeTrack`/`sampleViseme` (Task 4).
- Produces:
  - `interface AvatarEngineOptions { view?: 'upper' | 'full' }`
  - `class AvatarEngine` with:
    - `constructor(container: HTMLElement, opts?: AvatarEngineOptions)`
    - `init(): Promise<void>` — loads base VRM, starts render loop
    - `applySelection(selection: Selection): void` — race-guarded slot swap
    - `setEyeColor(hex: string | null): void`
    - `setExpression(name: string, value: number): void`
    - `speak(words: string[], wtimes: number[], wdurations: number[]): void`
    - `dispose(): void`

- [ ] **Step 1: Implement the engine**

```ts
// lib/avatar/engine.ts
// Vanilla-three imperative avatar engine. Mounts into a container element (no R3F).
// Ports the slot-swap orchestration + idle loop from avatar-composer-main/AvatarComposer.tsx
// and the toon-shading pass from components/AvatarOverlay.tsx, and adds a TTS viseme driver.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRM, VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } from '@pixiv/three-vrm'
import { BASE_URL, CATALOG, PartCategory, Selection, VARIANTS_BY_ID } from './catalog'
import { loadPart, loadSpringPart, loadFacePart, LoadedPart, LoadedSpringPart, LoadedFacePart } from './partLoader'
import { buildVisemeTrack, sampleViseme, VisemeKey } from './visemes'

type AnyLoadedPart = LoadedPart | LoadedSpringPart | LoadedFacePart
interface Slot { variantId: string; loaded: AnyLoadedPart }
export interface AvatarEngineOptions { view?: 'upper' | 'full' }

export class AvatarEngine {
  private container: HTMLElement
  private view: 'upper' | 'full'
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private clock = new THREE.Clock()
  private vrm: VRM | null = null
  private raf = 0
  private disposed = false

  // slot swap state
  private slots = new Map<PartCategory, Slot>()
  private gen = new Map<PartCategory, number>()
  private faceRef: LoadedFacePart | null = null
  private eyeColor: string | null = null
  private pendingSelection: Selection | null = null

  // idle gaze + viseme state
  private gaze = { target: new THREE.Object3D(), cur: new THREE.Vector2(), goal: new THREE.Vector2(), t: 0 }
  private blinkT = 0
  private speakTrack: VisemeKey[] | null = null
  private speakStart = 0

  // shared toon gradient
  private gradientMap: THREE.DataTexture

  constructor(container: HTMLElement, opts: AvatarEngineOptions = {}) {
    this.container = container
    this.view = opts.view ?? 'upper'
    const w = container.clientWidth || 1, h = container.clientHeight || 1
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.toneMappingExposure = 0.9
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 20)
    this.placeCamera()

    this.scene.add(new THREE.AmbientLight(0xffffff, 2.5))
    const dir = new THREE.DirectionalLight(0xffffff, 3)
    dir.position.set(0.5, 2, 2)
    this.scene.add(dir)

    const grad = new Uint8Array([160, 255])
    this.gradientMap = new THREE.DataTexture(grad, 2, 1, THREE.RedFormat)
    this.gradientMap.minFilter = THREE.NearestFilter
    this.gradientMap.magFilter = THREE.NearestFilter
    this.gradientMap.needsUpdate = true

    window.addEventListener('resize', this.onResize)
  }

  private placeCamera() {
    if (this.view === 'upper') { this.camera.position.set(0, 1.38, 1.05); this.camera.lookAt(0, 1.34, 0) }
    else { this.camera.position.set(0, 0.95, 2.7); this.camera.lookAt(0, 0.95, 0) }
  }

  private onResize = () => {
    if (this.disposed) return
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  // MToon parts (base) are already toon; extracted GLB parts come in as MeshStandardMaterial — match them.
  private toonify(root: THREE.Object3D) {
    const replace = (mat: THREE.Material): THREE.Material => {
      const std = mat as THREE.MeshStandardMaterial
      if (!std.isMeshStandardMaterial) return mat
      const toon = new THREE.MeshToonMaterial({
        map: std.map, color: std.color.clone(), gradientMap: this.gradientMap,
        alphaMap: std.alphaMap, transparent: std.transparent, opacity: std.opacity,
        alphaTest: std.alphaTest, side: std.side, depthWrite: std.depthWrite,
      })
      std.dispose()
      return toon
    }
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = Array.isArray(m.material) ? m.material.map(replace) : replace(m.material)
    })
  }

  async init(): Promise<void> {
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))
    const gltf = await loader.loadAsync(BASE_URL)
    if (this.disposed) return
    const vrm = gltf.userData.vrm as VRM
    this.vrm = vrm
    VRMUtils.rotateVRM0(vrm)
    this.toonify(vrm.scene)
    this.scene.add(vrm.scene)
    if (this.pendingSelection) { const s = this.pendingSelection; this.pendingSelection = null; this.applySelection(s) }
    this.loop()
  }

  applySelection(selection: Selection): void {
    if (!this.vrm) { this.pendingSelection = selection; return }
    const base = this.vrm
    const apply = async (cat: PartCategory, desired: string | null) => {
      const slot = this.slots.get(cat)
      if ((slot?.variantId ?? null) === desired) return
      const g = (this.gen.get(cat) ?? 0) + 1
      this.gen.set(cat, g)
      if (slot) { slot.loaded.dispose(); this.slots.delete(cat); if (cat === 'face') this.faceRef = null }
      if (!desired) return
      const resolved = VARIANTS_BY_ID.get(desired)
      if (!resolved) return
      const load = resolved.kind === 'spring' ? loadSpringPart : resolved.kind === 'face' ? loadFacePart : loadPart
      try {
        const loaded = await load(resolved.variant.url, base)
        if (this.gen.get(cat) !== g || this.disposed) { loaded.dispose(); return }
        this.slots.set(cat, { variantId: desired, loaded })
        if (cat === 'face') { this.faceRef = loaded as LoadedFacePart; this.faceRef.setEyeColor(this.eyeColor) }
        loaded.setVisible(true)
        if ((loaded as LoadedPart).root) this.toonify((loaded as LoadedPart).root)
      } catch (err) {
        if (this.gen.get(cat) === g) console.error(`[avatar:${cat}] load failed`, err)
      }
    }
    CATALOG.forEach((c) => apply(c.id, selection[c.id] ?? null))
  }

  setEyeColor(hex: string | null): void { this.eyeColor = hex; this.faceRef?.setEyeColor(hex) }

  setExpression(name: string, value: number): void {
    const em = this.vrm?.expressionManager
    if (!em) return
    em.expressions.forEach((e) => em.setValue(e.expressionName, 0))
    em.setValue(name, value)
  }

  speak(words: string[], wtimes: number[], wdurations: number[]): void {
    this.speakTrack = buildVisemeTrack(words, wtimes, wdurations)
    this.speakStart = performance.now()
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const v = this.vrm
    const delta = this.clock.getDelta()
    if (!v) { this.renderer.render(this.scene, this.camera); return }

    // idle gaze (ported from AvatarComposer)
    const gz = this.gaze
    if (v.lookAt && v.lookAt.target !== gz.target) v.lookAt.target = gz.target
    gz.t -= delta
    if (gz.t <= 0) { gz.t = 1.4 + Math.random() * 2.4; gz.goal.set((Math.random() * 2 - 1) * 0.35, (Math.random() * 2 - 1) * 0.18) }
    gz.cur.lerp(gz.goal, Math.min(1, delta * 2.5))
    const headBone = v.humanoid.getRawBoneNode(VRMHumanBoneName.Head)
    if (headBone) {
      headBone.getWorldPosition(gz.target.position)
      gz.target.position.x += gz.cur.x; gz.target.position.y += gz.cur.y; gz.target.position.z += 1.0
      gz.target.updateMatrixWorld()
    }
    // arms down (A-pose -> rest)
    const armL = v.humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm)
    const armR = v.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm)
    if (armL) armL.rotation.z = -1.3
    if (armR) armR.rotation.z = 1.3

    const em = v.expressionManager
    if (em) {
      // blink
      this.blinkT -= delta
      let blink = 0
      if (this.blinkT <= 0) { this.blinkT = 2 + Math.random() * 3 }
      else if (this.blinkT < 0.15) { blink = 1 - Math.abs(this.blinkT - 0.075) / 0.075 }
      em.setValue('blink', blink)
      // viseme
      let aa = 0
      if (this.speakTrack) {
        const tMs = performance.now() - this.speakStart
        aa = sampleViseme(this.speakTrack, tMs)
        if (tMs > this.speakTrack[this.speakTrack.length - 1].t) this.speakTrack = null
      }
      em.setValue('aa', aa)
    }

    v.update(delta)
    this.faceRef?.sync()
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    this.slots.forEach((s) => s.loaded.dispose())
    this.slots.clear()
    this.faceRef = null
    if (this.vrm) VRMUtils.deepDispose(this.vrm.scene)
    this.gradientMap.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode === this.container) this.container.removeChild(this.renderer.domElement)
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. (If `gltf.userData.vrm` types complain, cast: `(gltf.userData as { vrm: VRM }).vrm`.)

- [ ] **Step 3: Commit**

```bash
git add lib/avatar/engine.ts
git commit -m "feat(avatar): vanilla-three AvatarEngine (slot swap, idle, toon, visemes)"
```

(Visual verification of the engine happens in Task 8 when the editor mounts it.)

---

## Phase 2 — Editor

### Task 6: DB migration + types

**Files:**
- Create: `db/migrations/2026-06-17-avatar-config.sql`
- Modify: `lib/supabase/types.ts` (`Profile` interface + `profiles` Update type)

**Interfaces:**
- Produces: `Profile.avatar_config?: AvatarConfig | null` available to the app (the `AvatarConfig` type comes from Task 7; for now type it as the inline shape and re-export later).

- [ ] **Step 1: Write the migration SQL**

```sql
-- db/migrations/2026-06-17-avatar-config.sql
-- Stores the user's avatar selection JSON (no GLB). Public-readable via existing profiles RLS,
-- so a game's BJ (the creator's avatar) can be read by anyone viewing the game.
alter table public.profiles
  add column if not exists avatar_config jsonb;
```

- [ ] **Step 2: Apply it in Supabase**

Run this SQL in the Supabase SQL editor (or `supabase db` if configured). Confirm the column exists:
```sql
select column_name from information_schema.columns
where table_name = 'profiles' and column_name = 'avatar_config';
```
Expected: one row `avatar_config`.

- [ ] **Step 3: Update TypeScript types**

In `lib/supabase/types.ts`, add to the `Profile` interface (after `created_at`):
```ts
  avatar_config?: AvatarConfig | null
```
Add an import at the top of the file:
```ts
import type { AvatarConfig } from '@/lib/avatar/config'
```
(The `profiles` Update type is `Partial<Omit<Profile, 'id'>>`, so it already permits `avatar_config`.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean once Task 7's `config.ts` exists. If running this task first, temporarily inline the type; otherwise do Task 7 Step 1–3 before this typecheck. (Recommended order: Task 7 then Task 6 Step 3–4.)

- [ ] **Step 5: Commit**

```bash
git add db/migrations/2026-06-17-avatar-config.sql lib/supabase/types.ts
git commit -m "feat(avatar): add profiles.avatar_config column + types"
```

---

### Task 7: Config type + validation + storage helpers

**Files:**
- Create: `lib/avatar/config.ts`
- Create: `lib/avatar/storage.ts`
- Test: `lib/avatar/config.test.ts`

**Interfaces:**
- Produces (`config.ts`):
  - `interface AvatarConfig { selection: Selection; eyeColor: string | null; previewUrl?: string | null; version: 1 }`
  - `defaultConfig(): AvatarConfig`
  - `validateConfig(raw: unknown): AvatarConfig | null` — returns a normalized config or `null` if not a usable v1 config. Unknown/invalid variant ids in `selection` are dropped to `null`. `eyeColor` kept only if it matches `/^#[0-9a-fA-F]{6}$/`.
- Produces (`storage.ts`):
  - `loadAvatarConfig(supabase, userId): Promise<AvatarConfig | null>` — selects `avatar_config` from `profiles`.
  - `saveAvatarConfig(supabase, userId, config): Promise<{ error: string | null }>` — updates `profiles.avatar_config`.
  - `uploadPreview(supabase, userId, blob): Promise<string | null>` — uploads PNG to `avatars` bucket at `avatar-models/<userId>.png`, returns public URL or null.

- [ ] **Step 1: Write the failing test**

```ts
// lib/avatar/config.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateConfig, defaultConfig } from './config.ts'

test('defaultConfig is a valid v1 config', () => {
  const c = defaultConfig()
  assert.equal(c.version, 1)
  assert.ok('tops' in c.selection)
})

test('validateConfig drops unknown variant ids to null', () => {
  const c = validateConfig({ version: 1, eyeColor: null, selection: { tops: 'nope', bottoms: 'bottoms-jean', hair: null, face: null } })
  assert.equal(c?.selection.tops, null)
  assert.equal(c?.selection.bottoms, 'bottoms-jean')
})

test('validateConfig keeps only #rrggbb eye colors', () => {
  assert.equal(validateConfig({ version: 1, selection: {}, eyeColor: 'red' })?.eyeColor, null)
  assert.equal(validateConfig({ version: 1, selection: {}, eyeColor: '#aabbcc' })?.eyeColor, '#aabbcc')
})

test('validateConfig rejects non-objects and wrong version', () => {
  assert.equal(validateConfig(null), null)
  assert.equal(validateConfig({ version: 2, selection: {} }), null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/avatar/config.test.ts`
Expected: FAIL — cannot find module `./config.ts`.

- [ ] **Step 3: Implement config.ts**

```ts
// lib/avatar/config.ts
import { CATALOG, PartCategory, Selection, VARIANTS_BY_ID, defaultSelection } from './catalog'

export interface AvatarConfig {
  selection: Selection
  eyeColor: string | null
  previewUrl?: string | null
  version: 1
}

export const defaultConfig = (): AvatarConfig => ({ selection: defaultSelection(), eyeColor: null, version: 1 })

const HEX = /^#[0-9a-fA-F]{6}$/

export function validateConfig(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.version !== 1) return null
  const inSel = (r.selection && typeof r.selection === 'object' ? r.selection : {}) as Record<string, unknown>
  const selection = {} as Selection
  for (const cat of CATALOG) {
    const id = inSel[cat.id]
    selection[cat.id as PartCategory] = typeof id === 'string' && VARIANTS_BY_ID.has(id) ? id : null
  }
  const eyeColor = typeof r.eyeColor === 'string' && HEX.test(r.eyeColor) ? r.eyeColor : null
  const previewUrl = typeof r.previewUrl === 'string' ? r.previewUrl : null
  return { selection, eyeColor, previewUrl, version: 1 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/avatar/config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement storage.ts**

```ts
// lib/avatar/storage.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { AvatarConfig, validateConfig } from './config'

export async function loadAvatarConfig(supabase: SupabaseClient, userId: string): Promise<AvatarConfig | null> {
  const { data } = await supabase.from('profiles').select('avatar_config').eq('id', userId).single()
  return validateConfig((data as { avatar_config?: unknown } | null)?.avatar_config)
}

export async function saveAvatarConfig(supabase: SupabaseClient, userId: string, config: AvatarConfig): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update({ avatar_config: config } as never).eq('id', userId)
  return { error: error?.message ?? null }
}

export async function uploadPreview(supabase: SupabaseClient, userId: string, blob: Blob): Promise<string | null> {
  const path = `avatar-models/${userId}.png`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/png' })
  if (error) return null
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}
```

- [ ] **Step 6: Typecheck + lint + commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.
```bash
git add lib/avatar/config.ts lib/avatar/config.test.ts lib/avatar/storage.ts
git commit -m "feat(avatar): config type, validation, and supabase storage helpers"
```

---

### Task 8: Editor page + catalog picker

**Files:**
- Create: `components/avatar/AvatarStage.tsx`
- Create: `components/avatar/CatalogPicker.tsx`
- Create: `app/avatar/page.tsx`
- Modify: `app/profile/page.tsx` (add a link to `/avatar` in the MY AGENT section)

**Interfaces:**
- Consumes: `AvatarEngine` (Task 5), `CATALOG`/`Selection`/`PartCategory` (Task 2), `AvatarConfig`/`defaultConfig`/`validateConfig` (Task 7), `loadAvatarConfig`/`saveAvatarConfig`/`uploadPreview` (Task 7), `createClient` from `@/lib/supabase/client`.
- Produces:
  - `AvatarStage` — `forwardRef` exposing `AvatarStageHandle = { snapshot(): Promise<Blob | null>; setExpression(name: string): void }` via an imperative handle; props `{ selection, eyeColor, view? }` it pushes into the engine on change.
  - `CatalogPicker` — props `{ selection, eyeColor, onSelect(cat, variantId), onEyeColor(hex), onExpression(name,value) }`.

- [ ] **Step 1: Implement AvatarStage (engine mount)**

```tsx
// components/avatar/AvatarStage.tsx
'use client'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { AvatarEngine } from '@/lib/avatar/engine'
import type { Selection } from '@/lib/avatar/catalog'

export interface AvatarStageHandle {
  snapshot: () => Promise<Blob | null>
  setExpression: (name: string) => void
}
interface Props { selection: Selection; eyeColor: string | null; view?: 'upper' | 'full' }

export default forwardRef<AvatarStageHandle, Props>(function AvatarStage({ selection, eyeColor, view = 'full' }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<AvatarEngine | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const engine = new AvatarEngine(containerRef.current, { view })
    engineRef.current = engine
    engine.init().catch((e) => console.error('[AvatarStage] init failed', e))
    return () => { engine.dispose(); engineRef.current = null }
  }, [view])

  useEffect(() => { engineRef.current?.applySelection(selection) }, [selection])
  useEffect(() => { engineRef.current?.setEyeColor(eyeColor) }, [eyeColor])

  useImperativeHandle(ref, () => ({
    snapshot: async () => {
      const canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null
      if (!canvas) return null
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
    },
    setExpression: (name: string) => engineRef.current?.setExpression(name, name === 'neutral' ? 0 : 1),
  }), [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
})
```

- [ ] **Step 2: Implement CatalogPicker (UI)**

```tsx
// components/avatar/CatalogPicker.tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'
import { CATALOG, PartCategory, Selection } from '@/lib/avatar/catalog'

const EYE_COLORS = ['#5b3a29', '#2b2b2b', '#1f5fa8', '#3f8f4f', '#7a3f8f', '#a83232']
const EXPRESSIONS = [
  { name: 'neutral', label: '기본' }, { name: 'happy', label: '미소' },
  { name: 'angry', label: '화남' }, { name: 'sad', label: '슬픔' }, { name: 'surprised', label: '놀람' },
]

interface Props {
  selection: Selection
  eyeColor: string | null
  onSelect: (cat: PartCategory, variantId: string | null) => void
  onEyeColor: (hex: string | null) => void
  onExpression: (name: string, value: number) => void
}

export default function CatalogPicker({ selection, eyeColor, onSelect, onEyeColor, onExpression }: Props) {
  const [tab, setTab] = useState<PartCategory | 'eye' | 'expr'>('tops')
  const tabClass = (active: boolean) =>
    `font-pixel text-[9px] px-3 py-2 tracking-widest transition-colors ${active ? 'bg-[#00ff41] text-black' : 'text-gray-400 hover:text-white border border-gray-800'}`

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-800">
        {CATALOG.map((c) => <button key={c.id} onClick={() => setTab(c.id)} className={tabClass(tab === c.id)}>{c.label}</button>)}
        <button onClick={() => setTab('eye')} className={tabClass(tab === 'eye')}>눈색</button>
        <button onClick={() => setTab('expr')} className={tabClass(tab === 'expr')}>표정</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {CATALOG.filter((c) => c.id === tab).map((c) => (
          <div key={c.id} className="grid grid-cols-3 gap-2">
            {c.allowNone && (
              <button onClick={() => onSelect(c.id, null)}
                className={`aspect-square border flex items-center justify-center text-[9px] font-pixel ${selection[c.id] == null ? 'border-[#00ff41] text-[#00ff41]' : 'border-gray-800 text-gray-500'}`}>없음</button>
            )}
            {c.variants.map((v) => (
              <button key={v.id} onClick={() => onSelect(c.id, v.id)}
                className={`relative aspect-square border overflow-hidden ${selection[c.id] === v.id ? 'border-[#00ff41]' : 'border-gray-800 hover:border-gray-600'}`}>
                <Image src={v.thumb} alt={v.label} fill className="object-cover" unoptimized />
                <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-white py-0.5 text-center truncate">{v.label}</span>
              </button>
            ))}
          </div>
        ))}
        {tab === 'eye' && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onEyeColor(null)} className={`w-9 h-9 border ${eyeColor == null ? 'border-[#00ff41]' : 'border-gray-800'} text-[8px] text-gray-400 font-pixel`}>기본</button>
            {EYE_COLORS.map((hex) => (
              <button key={hex} onClick={() => onEyeColor(hex)} style={{ background: hex }}
                className={`w-9 h-9 border-2 ${eyeColor === hex ? 'border-[#00ff41]' : 'border-transparent'}`} />
            ))}
          </div>
        )}
        {tab === 'expr' && (
          <div className="flex flex-wrap gap-2">
            {EXPRESSIONS.map((e) => (
              <button key={e.name} onClick={() => onExpression(e.name, e.name === 'neutral' ? 0 : 1)}
                className="font-pixel text-[9px] border border-gray-800 text-gray-300 hover:border-[#00ff41] px-3 py-2 tracking-widest">{e.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement the editor page**

```tsx
// app/avatar/page.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { PartCategory, Selection } from '@/lib/avatar/catalog'
import { AvatarConfig, defaultConfig } from '@/lib/avatar/config'
import { loadAvatarConfig, saveAvatarConfig, uploadPreview } from '@/lib/avatar/storage'
import CatalogPicker from '@/components/avatar/CatalogPicker'
import type { AvatarStageHandle } from '@/components/avatar/AvatarStage'

const AvatarStage = dynamic(() => import('@/components/avatar/AvatarStage'), { ssr: false })

export default function AvatarEditorPage() {
  const router = useRouter()
  const supabase = createClient()
  const stageRef = useRef<AvatarStageHandle>(null)
  const [user, setUser] = useState<User | null>(null)
  const [config, setConfig] = useState<AvatarConfig>(defaultConfig)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/avatar'); return }
      setUser(user)
      const saved = await loadAvatarConfig(supabase, user.id)
      if (saved) setConfig(saved)
      setLoading(false)
    })
  }, [])

  const setSel = (cat: PartCategory, variantId: string | null) =>
    setConfig((c) => ({ ...c, selection: { ...c.selection, [cat]: variantId } as Selection }))

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    let previewUrl = config.previewUrl ?? null
    const blob = await stageRef.current?.snapshot()
    if (blob) previewUrl = (await uploadPreview(supabase, user.id, blob)) ?? previewUrl
    const toSave: AvatarConfig = { ...config, previewUrl, version: 1 }
    const { error } = await saveAvatarConfig(supabase, user.id, toSave)
    setConfig(toSave)
    setSaving(false)
    setMsg(error ? { text: '저장 실패: ' + error, ok: false } : { text: '저장되었습니다.', ok: true })
    setTimeout(() => setMsg(null), 3000)
  }

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-10"><p className="font-pixel text-[10px] text-gray-400 tracking-widest">LOADING...</p></div>

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest">MY CHARACTER</h1>
      <p className="text-xs text-gray-500">나만의 아바타를 꾸미고 저장하면, 내가 만든 게임의 방송 BJ가 됩니다.</p>
      <div className="grid md:grid-cols-2 gap-4 border border-gray-800 bg-[#0d0d0d]">
        <div className="h-[460px] bg-[#050508]">
          <AvatarStage ref={stageRef} selection={config.selection} eyeColor={config.eyeColor} view="full" />
        </div>
        <div className="h-[460px] border-l border-gray-800">
          <CatalogPicker
            selection={config.selection}
            eyeColor={config.eyeColor}
            onSelect={setSel}
            onEyeColor={(hex) => setConfig((c) => ({ ...c, eyeColor: hex }))}
            onExpression={(name) => stageRef.current?.setExpression(name)}
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={saving} className="font-pixel text-[10px] bg-[#00ff41] text-black px-8 py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50 tracking-widest">
          {saving ? 'SAVING...' : 'SAVE'}
        </button>
        {msg && <span className={`text-xs font-pixel tracking-widest ${msg.ok ? 'text-[#00ff41]' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </div>
  )
}
```

NOTE on expression preview: expression is forwarded to the engine through the `AvatarStage` imperative handle (`stageRef.current?.setExpression(name)`), which calls `engine.setExpression(name, name === 'neutral' ? 0 : 1)`. No DOM events involved.

- [ ] **Step 4: Add the editor link in profile**

In `app/profile/page.tsx`, inside the MY AGENT `<section>` (near the SAVE AGENT button, around line 327), add:
```tsx
        <a href="/avatar" className="inline-block font-pixel text-[10px] border border-[#00ff41] text-[#00ff41] px-6 py-2.5 hover:bg-[#00ff41] hover:text-black transition-colors tracking-widest">
          🎨 MY CHARACTER 만들기
        </a>
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Fix any issues (especially the `app/avatar/page.tsx` import typo noted above).

- [ ] **Step 6: Manual browser verification**

Run: `npm run dev`, log in, open `http://localhost:3000/avatar`.
Expected, observe in order:
1. A 3D character renders in the left panel within a few seconds (base body + default shirt/pants/hair).
2. Clicking a different **상의/하의** thumbnail swaps the clothing on the model live.
3. Clicking **없음** removes that part; reselecting restores it.
4. Changing **눈색** tints the irises.
5. Clicking **표정** buttons changes the face expression.
6. **SAVE** shows "저장되었습니다." Reload the page → selections persist (loaded from `profiles.avatar_config`).
7. In Supabase, `profiles.avatar_config` for your user is populated, and `avatars/avatar-models/<userId>.png` exists.

- [ ] **Step 7: Commit**

```bash
git add app/avatar/page.tsx components/avatar/AvatarStage.tsx components/avatar/CatalogPicker.tsx app/profile/page.tsx
git commit -m "feat(avatar): avatar editor page with live preview, catalog picker, and save"
```

---

## Phase 3 — In-game BJ

### Task 9: CustomAvatarOverlay (in-game renderer)

**Files:**
- Create: `components/CustomAvatarOverlay.tsx`

**Interfaces:**
- Consumes: `AvatarEngine` (Task 5), `AvatarConfig` (Task 7). Reuses the existing Google-TTS flow + `avatar:speak` event contract from `components/AvatarOverlay.tsx`.
- Produces: default-exported React component `CustomAvatarOverlay({ config }: { config: AvatarConfig })`.

- [ ] **Step 1: Implement the component**

```tsx
// components/CustomAvatarOverlay.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { AvatarEngine } from '@/lib/avatar/engine'
import type { AvatarConfig } from '@/lib/avatar/config'

const TTS_KEY = process.env.NEXT_PUBLIC_GOOGLE_TTS_API_KEY ?? ''
let sharedAudioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') sharedAudioCtx = new AudioContext()
  return sharedAudioCtx
}

export default function CustomAvatarOverlay({ config }: { config: AvatarConfig }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<AvatarEngine | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!containerRef.current) return
    const engine = new AvatarEngine(containerRef.current, { view: 'upper' })
    engineRef.current = engine
    engine.init()
      .then(() => { engine.applySelection(config.selection); engine.setEyeColor(config.eyeColor); setStatus('ready') })
      .catch((e) => { console.error('[CustomAvatar] init failed', e); setStatus('error') })
    return () => { engine.dispose(); engineRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // re-apply if config changes
  useEffect(() => { engineRef.current?.applySelection(config.selection); engineRef.current?.setEyeColor(config.eyeColor) }, [config])

  useEffect(() => {
    const handler = async (e: Event) => {
      const engine = engineRef.current
      if (!engine || !TTS_KEY) return
      const text = (e as CustomEvent<{ text: string }>).detail?.text?.trim()
      if (!text) return
      try {
        const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: { text }, voice: { languageCode: 'en-US', name: 'en-US-Wavenet-F' }, audioConfig: { audioEncoding: 'MP3' } }),
        })
        const json = await res.json()
        if (!json.audioContent) return
        const binary = atob(json.audioContent)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const ctx = getAudioCtx()
        if (ctx.state === 'suspended') await ctx.resume()
        const audio = await ctx.decodeAudioData(bytes.buffer.slice(0))
        const words = text.split(/\s+/).filter(Boolean)
        const totalMs = audio.duration * 1000
        const perWord = totalMs / Math.max(words.length, 1)
        engine.speak(words, words.map((_, i) => i * perWord), words.map(() => perWord * 0.85))
        const src = ctx.createBufferSource()
        src.buffer = audio
        src.connect(ctx.destination)
        src.start()
      } catch (err) { console.error('[CustomAvatar] speak error', err) }
    }
    window.addEventListener('avatar:speak', handler)
    return () => window.removeEventListener('avatar:speak', handler)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#050508' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="w-6 h-6 border-2 border-[#00ff41] border-t-transparent rounded-full animate-spin" />
          <span className="font-pixel text-[8px] text-gray-500">LOADING BJ...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-pixel text-[8px] text-red-500">AVATAR ERROR</span>
        </div>
      )}
    </div>
  )
}
```

NOTE: `AvatarOverlay` relies on TalkingHead to play audio; here we play the decoded buffer ourselves (`createBufferSource`) so the lip-sync track and audio stay aligned. Keep the `avatar:speak` contract identical.

- [ ] **Step 2: Typecheck + lint + commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.
```bash
git add components/CustomAvatarOverlay.tsx
git commit -m "feat(avatar): in-game CustomAvatarOverlay (engine + TTS visemes)"
```

---

### Task 10: Wire BJ = game creator's avatar

**Files:**
- Modify: `components/GamePlayButton.tsx` (fetch creator config, pass to panel)
- Modify: `components/AiBjPanel.tsx` (choose renderer)

**Interfaces:**
- Consumes: `loadAvatarConfig` (Task 7), `AvatarConfig` (Task 7), `CustomAvatarOverlay` (Task 9), existing `AvatarOverlay`.
- Produces: `AiBjPanel` accepts a new optional prop `bjAvatarConfig?: AvatarConfig | null`.

- [ ] **Step 1: Fetch creator config in GamePlayButton**

In `components/GamePlayButton.tsx`:
- Add imports:
```tsx
import { loadAvatarConfig } from '@/lib/avatar/storage'
import type { AvatarConfig } from '@/lib/avatar/config'
```
- Add state near the other `useState` calls:
```tsx
  const [bjAvatarConfig, setBjAvatarConfig] = useState<AvatarConfig | null>(null)
```
- In `handlePlay`, after the `setOpen(true)` line, fetch the creator's avatar (game.user_id is the creator):
```tsx
    loadAvatarConfig(supabase, game.user_id).then(setBjAvatarConfig)
```
- Pass it to the panel — change the `<AiBjPanel ... />` line to include:
```tsx
            <AiBjPanel genre={game.genre} gameTitle={game.title} gameDescription={game.description} agentConfig={agentConfig} bjAvatarConfig={bjAvatarConfig} />
```

- [ ] **Step 2: Choose renderer in AiBjPanel**

In `components/AiBjPanel.tsx`:
- Add a dynamic import next to the existing `AvatarOverlay` dynamic import (line ~9):
```tsx
const CustomAvatarOverlay = dynamic(() => import('./CustomAvatarOverlay'), { ssr: false })
```
- Add imports:
```tsx
import type { AvatarConfig } from '@/lib/avatar/config'
```
- Add `bjAvatarConfig` to the component's props interface and destructure it:
```tsx
  bjAvatarConfig?: AvatarConfig | null
```
- Define a small renderer constant inside the component body:
```tsx
  const BjAvatar = () => bjAvatarConfig
    ? <CustomAvatarOverlay config={bjAvatarConfig} />
    : <AvatarOverlay />
```
- Replace the two `<AvatarOverlay />` usages (desktop ~line 299 and mobile ~line 353) with `<BjAvatar />`.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Manual browser verification**

Run: `npm run dev`.
- Setup: ensure your user has a saved avatar (Task 8), and that you own at least one game (or create one whose `user_id` is you).
Expected, observe:
1. Open a game **you created** → the play modal's BJ shows **your custom avatar** (not a random one), loading via "LOADING BJ...".
2. When the AI BJ speaks (the existing `avatar:speak` flow), the custom avatar's mouth moves and audio plays.
3. Open a game created by a **different user who has NO avatar_config** → the BJ falls back to the original random TalkingHead avatar (no regression).

- [ ] **Step 5: Commit**

```bash
git add components/GamePlayButton.tsx components/AiBjPanel.tsx
git commit -m "feat(avatar): BJ uses game creator's saved avatar, fallback to legacy"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Engine reuse (vanilla three, no R3F) → Tasks 3, 5. ✓
- Asset build + import to `public/avatars/composer/` → Task 1. ✓
- `lib/avatar/{catalog,partLoader,engine}` → Tasks 2, 3, 5. ✓
- Editor `/avatar` + catalog picker + save → Task 8. ✓
- Persistence on `profiles.avatar_config` (not user_metadata) → Tasks 6, 7. ✓
- Preview PNG to `avatars` bucket → Tasks 7 (`uploadPreview`), 8 (snapshot on save). ✓
- BJ = creator's avatar, renderer switch, TTS visemes, legacy fallback → Tasks 9, 10. ✓
- Customization axes: clothing/hair/eye-color/expression → Tasks 2 (catalog), 8 (picker). ✓

**Placeholder scan:** None. (Expression preview is wired through `AvatarStageHandle.setExpression` directly — no placeholder events.)

**Type consistency:** `AvatarConfig`, `Selection`, `PartCategory`, `AvatarEngine` method names (`init`/`applySelection`/`setEyeColor`/`setExpression`/`speak`/`dispose`), `loadAvatarConfig`/`saveAvatarConfig`/`uploadPreview`, `AvatarStageHandle` are used consistently across tasks. `AvatarStageHandle` is extended to include `setExpression` per the Task 8 note — ensure the interface and `useImperativeHandle` both list `snapshot` and `setExpression`.
