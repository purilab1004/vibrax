import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'
import * as THREE from 'three'
import { useLipsync } from './useLipsync'
import { useAnimator } from './anim/useAnimator'
import { type StateName } from './anim/scheduler'
import { useLookAt } from './useLookAt'
import { type SpeakPayload } from './tts'
import { type MoodName } from './locales'
import { useAvatarStore } from '../store'
import { getCharacter } from '../editor/constants'
import { useAssembledVrm } from '../editor/useAssembledVrm'

export interface CameraSettings {
  position: [number, number, number]
  target: [number, number, number]
}

interface Props {
  // 업로드 오버라이드(있으면 단일 VRM). 없으면 store 캐릭터 base + 선택 파츠를 조립(에디터와 동일).
  uploadUrl?: string | null
  speaking: boolean
  mood: MoodName
  onReady: (speak: (payload: SpeakPayload) => void) => void
  onCameraReady?: (s: CameraSettings) => void
  // 모든 파츠 조립 완료 여부 — 호스트가 로딩 표시/완성 후 표시를 제어
  onAssembledChange?: (assembled: boolean) => void
}

function computeUpperBodyCamera(vrm: VRM): CameraSettings {
  vrm.scene.updateWorldMatrix(true, true)

  const headBone = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head)
  const hipsBone = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Hips)

  const headPos = new THREE.Vector3()
  const hipsPos = new THREE.Vector3()
  headBone?.getWorldPosition(headPos)
  hipsBone?.getWorldPosition(hipsPos)

  // 본이 없거나 origin에 있으면 표준 VRM 신장으로 fallback
  if (headPos.y < 0.1) headPos.y = 1.6
  if (hipsPos.y < 0.1) hipsPos.y = 0.95

  const torsoHeight = headPos.y - hipsPos.y  // hips → head 본 거리

  // 머리 위 한계: 본 기반 추정(고정 비율)은 헤어/모자 볼륨이 큰 모델에서 잘림.
  // 실제 메시 바운딩박스 최상단 = 머리카락 끝까지 정확히 포함 (모델 불문)
  const bbox = new THREE.Box3().setFromObject(vrm.scene)
  const headEstimate = headPos.y + torsoHeight * 0.3 // bbox 비정상 시 fallback
  const meshTop = isFinite(bbox.max.y) ? bbox.max.y : headEstimate
  const spanTop = Math.max(meshTop, headEstimate) + torsoHeight * 0.05 // 머리 위 5% 여백
  const spanBot = hipsPos.y + torsoHeight * 0.15
  const targetY = (spanTop + spanBot) / 2
  const verticalSpan = spanTop - spanBot

  // fov=28 기준으로 수직 범위가 딱 맞는 거리 계산 (10% 여백)
  const fov = 28
  const dist = (verticalSpan / 2) / Math.tan(((fov * Math.PI) / 180) / 2) * 1.1

  return {
    target: [0, targetY, 0],
    position: [0, targetY, dist],
  }
}

export function CompanionAvatar({ uploadUrl, speaking, mood, onReady, onCameraReady, onAssembledChange }: Props) {
  // useAnimator 가 useFrame 안에서 읽는 미러 ref — props 변경을 effect 로 commit 후 반영.
  // (렌더 중 직접 대입은 react-hooks/refs 위반)
  const stateRef = useRef<StateName>('idle')
  const moodRef = useRef<string>('neutral')
  useEffect(() => { stateRef.current = speaking ? 'speaking' : 'idle' }, [speaking])
  useEffect(() => { moodRef.current = mood }, [mood])

  // 조립 소스: 업로드 VRM(파츠 0개) 또는 store 캐릭터 base + 카탈로그(에디터 store 공유).
  const characterId = useAvatarStore((s) => s.characterId)
  const selection = useAvatarStore((s) => s.selection)
  const partStatus = useAvatarStore((s) => s.partStatus)
  const character = getCharacter(characterId)
  const baseUrl = uploadUrl || character.baseUrl
  const catalog = uploadUrl ? [] : character.catalog

  const { vrm, vrmRef, syncFace } = useAssembledVrm(baseUrl, catalog)

  // 조립 완료 게이트 — 선택된 파츠가 전부 terminal 상태(loaded/error/missing)일 때만 표시.
  // 베이스만 먼저 보이고 옷/머리가 하나씩 붙는 progressive pop-in 을 막는다(완성된 모습 한 번에).
  const partsReady = !!vrm && catalog.every((c) => {
    if (!selection[c.id]) return true            // 미선택 슬롯은 대기 불필요
    const st = partStatus[c.id]
    return st === 'loaded' || st === 'error' || st === 'missing'
  })
  // 안전장치: 일부 파츠 로드가 지연/실패해도 8초 후엔 보이는 만큼 노출(영구 스피너 방지)
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (!vrm) return
    const t = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(t)
  }, [vrm])
  const assembled = partsReady || (!!vrm && timedOut)

  const { speak } = useLipsync(vrmRef)
  useAnimator(vrmRef, stateRef, moodRef)
  useLookAt(vrmRef)

  // 조립 base 의 dispose/회전은 useAssembledVrm 이 담당. 여기선 ready/카메라만.
  useEffect(() => {
    if (vrm) onReady(speak)
  }, [vrm, onReady, speak])

  // 카메라 프레이밍은 조립 완료 후(머리카락 포함 실제 메시 높이 반영) + 호스트에 완료 통지.
  useEffect(() => {
    if (assembled && vrm) onCameraReady?.(computeUpperBodyCamera(vrm))
    onAssembledChange?.(assembled)
  }, [assembled, vrm, onCameraReady, onAssembledChange])

  useFrame((_, delta) => {
    const v = vrmRef.current
    if (!v) return
    v.update(delta)
    syncFace() // 얼굴 교체 시: base 표정/립싱크/시선 → 교체된 Face 미러
  })

  if (!vrm) return null
  // 조립 전엔 씬을 숨김(투명) → 완성되면 한 번에 노출
  return <primitive object={vrm.scene} visible={assembled} />
}
