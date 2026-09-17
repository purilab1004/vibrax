'use client'
// lib/live/avatarFace.ts — 카메라 속 내 얼굴을 AJ 아바타 얼굴로 바꿔 방송하는 스트림.
// MediaPipe FaceLandmarker(브라우저 안에서 동작)로 얼굴 위치 + 머리 방향(yaw/pitch/roll) + 입 벌림·눈 깜빡임을 읽고,
// 내 3D 점토 아바타를 그 자세로 매 프레임 렌더해 카메라 위 얼굴 자리에 덮는다.
//  · 3D 를 못 쓰면(아바타 데이터 없음·WebGL 불가) 프리뷰 PNG 로 대신(말하기·깜빡임 프레임)
//  · 얼굴을 잠깐 놓쳐도 마지막 위치에 계속 덮는다(순간적으로 실제 얼굴이 드러나지 않게)
// 결과: canvas.captureStream + 원래 마이크 트랙 → 기존 WebRTC 방송(startHost)에 그대로 넣는다.
import type { FaceLandmarker } from '@mediapipe/tasks-vision'

const VERSION = '1.0.1'
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

// 아바타 정사각 이미지(프리뷰 PNG·3D 렌더 같은 구도) 안에서 '얼굴 중심'과 '머리 폭'
const AV_FACE_CX = 0.5, AV_FACE_CY = 0.6, AV_HEAD_W = 0.64
const HEAD_OVER_FACE = 1.75   // 얼굴 랜드마크 폭(볼~볼) 대비 아바타 머리 폭
const RENDER = 512

let landmarkerPromise: Promise<FaceLandmarker> | null = null
function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision')
      const files = await FilesetResolver.forVisionTasks(WASM)
      const opts = (delegate: 'GPU' | 'CPU') => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO' as const, numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true })
      try { return await FaceLandmarker.createFromOptions(files, opts('GPU')) } catch { return await FaceLandmarker.createFromOptions(files, opts('CPU')) }
    })().catch((e) => { landmarkerPromise = null; throw e })
  }
  return landmarkerPromise
}

const loadImg = (src: string | null | undefined) => new Promise<HTMLImageElement | null>((res) => {
  if (!src) return res(null)
  const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async'
  im.onload = () => res(im); im.onerror = () => res(null); im.src = src
})

type Pose = { yaw: number; pitch: number; roll: number; jaw: number; blink: number }
type Posed = { renderPosed(p: Pose, size?: number): HTMLCanvasElement; dispose(): void }

/** 3D 아바타 뷰어를 화면 밖에 만들어 캐릭터를 로드 — 실패하면 null */
async function load3d(dataUrl: string | null | undefined): Promise<{ viewer: Posed; box: HTMLDivElement } | null> {
  if (!dataUrl) return null
  try {
    const [{ createJeumtoViewer }, { fetchCharacterData }] = await Promise.all([import('@/lib/jeumto/viewer.js'), import('@/lib/jeumto/storage')])
    const data = await fetchCharacterData(dataUrl)
    if (!data) return null
    const box = document.createElement('div')
    Object.assign(box.style, { position: 'fixed', left: '-10000px', top: '0', width: `${RENDER}px`, height: `${RENDER}px`, pointerEvents: 'none' })
    document.body.appendChild(box)
    const viewer = createJeumtoViewer(box, { interactive: false }) as unknown as Posed & { load(d: unknown): void }
    viewer.load(data)
    return { viewer, box }
  } catch (e) { console.warn('[avatar face] 3D 불가 — 이미지로 대신', e); return null }
}

export interface AvatarFaceHandle { stream: MediaStream; stop(): void }

export async function createAvatarFaceStream(cam: MediaStream, avatar: { previewUrl: string; blinkUrl?: string | null; talkUrl?: string | null; dataUrl?: string | null }): Promise<AvatarFaceHandle> {
  const [landmarker, base, blinkImg, talkImg, three] = await Promise.all([getLandmarker(), loadImg(avatar.previewUrl), loadImg(avatar.blinkUrl), loadImg(avatar.talkUrl), load3d(avatar.dataUrl)])
  if (!base && !three) throw new Error('아바타를 불러오지 못했어요')
  const { Matrix4, Euler } = await import('three')

  const video = document.createElement('video')
  video.muted = true; video.playsInline = true; video.srcObject = cam
  await video.play().catch(() => {})
  await new Promise<void>((r) => { if (video.videoWidth) r(); else video.onloadedmetadata = () => r() })

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480
  const ctx = canvas.getContext('2d')!

  // 3D 가 없을 때(이미지 모드) 말하기 감지용 마이크 음량
  let audioCtx: AudioContext | null = null, analyser: AnalyserNode | null = null
  const buf = new Uint8Array(512)
  if (!three && cam.getAudioTracks().length) {
    try {
      audioCtx = new AudioContext()
      analyser = audioCtx.createAnalyser(); analyser.fftSize = 512
      audioCtx.createMediaStreamSource(new MediaStream(cam.getAudioTracks())).connect(analyser)
    } catch { audioCtx = null; analyser = null }
  }
  const loudness = () => {
    if (!analyser) return 0
    analyser.getByteTimeDomainData(buf)
    let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
    return Math.sqrt(sum / buf.length)
  }

  const m4 = new Matrix4(), eul = new Euler()
  let running = true, raf = 0, lastVideoTime = -1, lastDraw = 0, frameNo = 0
  // 부드럽게 따라가는 얼굴 상태
  let fx = canvas.width / 2, fy = canvas.height * 0.42, fw = canvas.width * 0.16, found = false
  const pose: Pose = { yaw: 0, pitch: 0, roll: 0, jaw: 0, blink: 0 }
  let talkUntil = 0, nextBlink = performance.now() + 3000, blinkUntil = 0
  const clamp = (v: number, a: number) => Math.max(-a, Math.min(a, v))
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k

  const frame = () => {
    if (!running) return
    raf = requestAnimationFrame(frame)
    if (video.readyState < 2) return
    const now = performance.now()
    if (now - lastDraw < 1000 / 24) return   // 24fps 이상은 그리지 않는다
    lastDraw = now
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    // 얼굴 인식은 2프레임에 한 번(나머지는 직전 결과로) — 폰에서 게임 조작이 버벅이지 않게
    if (video.currentTime !== lastVideoTime && (frameNo++ % 2 === 0 || !found)) {
      lastVideoTime = video.currentTime
      try {
        const r = landmarker.detectForVideo(video, now)
        const lm = r.faceLandmarks[0]
        if (lm && lm.length) {
          let minX = 1, maxX = 0, minY = 1, maxY = 0
          for (const p of lm) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y }
          const cx = (minX + maxX) / 2 * canvas.width, cy = (minY + maxY) / 2 * canvas.height, w = (maxX - minX) * canvas.width
          const k = found ? 0.5 : 1
          fx = lerp(fx, cx, k); fy = lerp(fy, cy, k); fw = lerp(fw, w, k)
          found = true
          const mat = r.facialTransformationMatrixes?.[0]?.data
          if (mat) {
            m4.fromArray(mat); eul.setFromRotationMatrix(m4, 'YXZ')
            pose.pitch = lerp(pose.pitch, clamp(eul.x, 0.7), 0.5)
            pose.yaw = lerp(pose.yaw, clamp(eul.y, 0.9), 0.5)
            pose.roll = lerp(pose.roll, clamp(eul.z, 0.7), 0.5)
          }
          const bs = r.faceBlendshapes?.[0]?.categories
          if (bs) {
            const get = (n: string) => bs.find((c) => c.categoryName === n)?.score ?? 0
            pose.jaw = lerp(pose.jaw, get('jawOpen'), 0.6)
            pose.blink = Math.max(get('eyeBlinkLeft'), get('eyeBlinkRight'))
          }
        }
      } catch { /* 감지 실패 프레임은 건너뜀 */ }
    }
    const headW = fw * HEAD_OVER_FACE
    const size = headW / AV_HEAD_W
    const dx = fx - size * AV_FACE_CX, dy = fy - size * AV_FACE_CY
    if (three) {
      // 3D — 내 머리 방향·입·눈 그대로. 프리뷰 PNG 구도(가운데 95% 크롭)에 맞춰 그린다
      const src = three.viewer.renderPosed(pose, RENDER)
      const m = RENDER * 0.025
      ctx.drawImage(src, m, m, RENDER - 2 * m, RENDER - 2 * m, dx, dy, size, size)
    } else if (base) {
      if (loudness() > 0.045) talkUntil = now + 180
      if (now > nextBlink) { blinkUntil = now + 140; nextBlink = now + 3000 + Math.random() * 2500 }
      const img = (talkImg && now < talkUntil) ? talkImg : (blinkImg && now < blinkUntil) ? blinkImg : base
      ctx.save()
      ctx.translate(fx, fy); ctx.rotate(-pose.roll); ctx.translate(-fx, -fy)
      ctx.drawImage(img, dx, dy, size, size)
      ctx.restore()
    }
  }
  raf = requestAnimationFrame(frame)

  const out = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(24)
  for (const t of cam.getAudioTracks()) out.addTrack(t)

  return {
    stream: out,
    stop() {
      running = false; cancelAnimationFrame(raf)
      out.getVideoTracks().forEach((t) => t.stop())
      cam.getTracks().forEach((t) => t.stop())
      video.srcObject = null
      audioCtx?.close().catch(() => {})
      if (three) { try { three.viewer.dispose() } catch { /* noop */ } three.box.remove() }
    },
  }
}
