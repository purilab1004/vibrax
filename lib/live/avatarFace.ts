'use client'
// lib/live/avatarFace.ts — 카메라 속 내 얼굴을 AJ 아바타 얼굴로 바꿔 방송하는 스트림.
// MediaPipe FaceDetector(blaze_face short range, 브라우저 안에서 동작)로 얼굴 위치를 찾고, 매 프레임 카메라 위에 아바타 PNG 를 덮어 그린다.
//  · 말하면(마이크 음량) 입 벌린 프레임, 3~5초마다 눈 깜빡임 프레임
//  · 얼굴을 잠깐 놓쳐도 마지막 위치에 계속 덮는다(순간적으로 실제 얼굴이 드러나지 않게)
// 결과: canvas.captureStream + 원래 마이크 트랙 → 기존 WebRTC 방송(startHost)에 그대로 넣는다.
import type { FaceDetector } from '@mediapipe/tasks-vision'

const VERSION = '1.0.1'
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

// 아바타 PNG(512×512) 안에서 '얼굴 중심'과 '머리 폭' — 점토 아바타 스냅샷 기준
const AV_FACE_CX = 0.5, AV_FACE_CY = 0.6, AV_HEAD_W = 0.64
const HEAD_OVER_FACE = 1.9   // 감지된 얼굴 박스 폭 대비 아바타 머리 폭 (머리카락·턱선까지 가리게)

let detectorPromise: Promise<FaceDetector> | null = null
function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision')
      const files = await FilesetResolver.forVisionTasks(WASM)
      try {
        return await FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', minDetectionConfidence: 0.5 })
      } catch {
        return await FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' }, runningMode: 'VIDEO', minDetectionConfidence: 0.5 })
      }
    })().catch((e) => { detectorPromise = null; throw e })
  }
  return detectorPromise
}

const loadImg = (src: string | null | undefined) => new Promise<HTMLImageElement | null>((res) => {
  if (!src) return res(null)
  const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async'
  im.onload = () => res(im); im.onerror = () => res(null); im.src = src
})

export interface AvatarFaceHandle { stream: MediaStream; stop(): void }

export async function createAvatarFaceStream(cam: MediaStream, avatar: { previewUrl: string; blinkUrl?: string | null; talkUrl?: string | null }): Promise<AvatarFaceHandle> {
  const [detector, base, blink, talk] = await Promise.all([getDetector(), loadImg(avatar.previewUrl), loadImg(avatar.blinkUrl), loadImg(avatar.talkUrl)])
  if (!base) throw new Error('아바타 이미지를 불러오지 못했어요')

  const video = document.createElement('video')
  video.muted = true; video.playsInline = true; video.srcObject = cam
  await video.play().catch(() => {})
  await new Promise<void>((r) => { if (video.videoWidth) r(); else video.onloadedmetadata = () => r() })

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480
  const ctx = canvas.getContext('2d')!

  // 말하기 감지 — 마이크 음량
  let audioCtx: AudioContext | null = null, analyser: AnalyserNode | null = null
  const buf = new Uint8Array(512)
  if (cam.getAudioTracks().length) {
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

  let running = true, raf = 0, lastVideoTime = -1
  // 부드럽게 따라가는 얼굴 박스 (px)
  let fx = canvas.width / 2, fy = canvas.height * 0.42, fw = canvas.width * 0.16, found = false
  let talkUntil = 0, nextBlink = performance.now() + 3000, blinkUntil = 0

  const frame = () => {
    if (!running) return
    raf = requestAnimationFrame(frame)
    if (video.readyState < 2) return
    const now = performance.now()
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime
      try {
        const det = detector.detectForVideo(video, now).detections
        const box = det.sort((a, b) => (b.categories[0]?.score ?? 0) - (a.categories[0]?.score ?? 0))[0]?.boundingBox
        if (box && box.width > 0) {
          const cx = box.originX + box.width / 2, cy = box.originY + box.height / 2
          const k = found ? 0.45 : 1   // 처음 찾으면 바로, 이후엔 부드럽게
          fx += (cx - fx) * k; fy += (cy - fy) * k; fw += (box.width - fw) * k
          found = true
        }
      } catch { /* 감지 실패 프레임은 건너뜀 */ }
    }
    // 말하기·깜빡임 프레임 선택
    if (loudness() > 0.045) talkUntil = now + 180
    if (now > nextBlink) { blinkUntil = now + 140; nextBlink = now + 3000 + Math.random() * 2500 }
    const img = (talk && now < talkUntil) ? talk : (blink && now < blinkUntil) ? blink : base
    // 아바타 머리를 얼굴 위치에 — 얼굴을 못 찾았으면 화면 가운데
    const headW = fw * HEAD_OVER_FACE
    const size = headW / AV_HEAD_W
    ctx.drawImage(img, fx - size * AV_FACE_CX, fy - size * AV_FACE_CY, size, size)
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
    },
  }
}
