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
    const vrm = (gltf.userData as { vrm: VRM }).vrm
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
        // Only static GLB parts arrive as MeshStandardMaterial and need the toon pass.
        // Spring/face parts load via VRMLoaderPlugin (MToon, already toon) and their
        // `root` is the shared base scene — toonifying it again is a wasted full traversal.
        if (resolved.kind === 'static') this.toonify((loaded as LoadedPart).root)
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
        const last = this.speakTrack[this.speakTrack.length - 1]
        if (!last || tMs > last.t) this.speakTrack = null
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
