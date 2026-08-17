// lib/jeumto/presets.js — 점토 "모양 프리셋": 베이스 치수 + 프로그램 브러시 스트로크로 귀/뿔/납작 등을 만든다.
// 사용자는 프리셋에서 시작해 손으로 이어서 빚는다. (이미지→자동 빚기도 이 프리셋 위에 파츠를 얹는다)
import * as THREE from 'three';

const D = { width: 2, height: 2.4, depth: 1.8, radius: 0.6 };
const TOP = D.height / 2;

/** @typedef {{ id:string, label:string, emoji:string, base?:object, color?:string, strokes?:object[], parts?:object[] }} Preset */

/** 위쪽에서 길게 뽑아 올린 귀 두 개 — 브러시가 끝을 따라가며(advance) 늘인다 */
const longEars = (x, top, { radius = 0.3, steps = 40, amount = 0.07, advance = 0.035, tilt = 0 } = {}) => [
  { brush: 'pull', at: [x, top - 0.1, 0], dir: [Math.sin(tilt), Math.cos(tilt), 0], radius, amount, steps, advance, symmetry: true },
  { brush: 'smooth', at: [x, top + 0.5, 0], radius: radius * 1.5, amount: 0.2, steps: 4, symmetry: true },
];

/** @type {Preset[]} */
export const PRESETS = [
  { id: 'square', label: '둥근 사각', emoji: '🟪', base: { ...D }, color: '#c9a5e8' },
  { id: 'egg', label: '달걀', emoji: '🥚', base: { width: 1.9, height: 2.5, depth: 1.8, radius: 0.9 }, color: '#f2f2f2',
    strokes: [
      { brush: 'push', at: [0, -1.25, 0], dir: [0, -1, 0], radius: 1.1, amount: 0.02, steps: 8 }, // 아래를 눌러 조금 납작하게
      { brush: 'inflate', at: [0, 0.6, 0.9], radius: 1.2, amount: 0.02, steps: 6, symmetry: true },
    ] },
  { id: 'bun', label: '납작빵', emoji: '🍞', base: { width: 2.3, height: 1.8, depth: 2.0, radius: 0.75 }, color: '#e8b89a' },
  { id: 'tall', label: '길쭉이', emoji: '🧱', base: { width: 1.7, height: 2.9, depth: 1.6, radius: 0.55 }, color: '#8fa4c9' },
  { id: 'rabbit', label: '토끼귀', emoji: '🐰', base: { width: 2, height: 2.2, depth: 1.8, radius: 0.8 }, color: '#f7d6e0',
    strokes: longEars(0.45, 1.1, { radius: 0.32, steps: 44, amount: 0.07, advance: 0.035 }) },
  { id: 'bear', label: '곰귀', emoji: '🐻', base: { width: 2.1, height: 2.2, depth: 1.9, radius: 0.85 }, color: '#b07a4a',
    strokes: [
      { brush: 'pull', at: [0.78, 0.95, 0], dir: [0.55, 1, 0], radius: 0.5, amount: 0.08, steps: 12, advance: 0.02, symmetry: true },
      { brush: 'smooth', at: [0.95, 1.35, 0], radius: 0.6, amount: 0.25, steps: 5, symmetry: true },
    ] },
  { id: 'cat', label: '고양이귀', emoji: '🐱', base: { width: 2.1, height: 2.1, depth: 1.8, radius: 0.7 }, color: '#f2c98a',
    strokes: [
      { brush: 'pull', at: [0.7, 0.95, 0], dir: [0.4, 1, 0], radius: 0.42, amount: 0.08, steps: 20, advance: 0.03, symmetry: true },
    ] },
  { id: 'horn', label: '뿔', emoji: '🦄', base: { ...D, radius: 0.7 }, color: '#b8b39a',
    strokes: [
      { brush: 'pull', at: [0, TOP - 0.1, 0.15], dir: [0, 1, 0.2], radius: 0.36, amount: 0.08, steps: 34, advance: 0.03 },
    ] },
];

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

/**
 * 프리셋 적용: 베이스 교체(파츠 제거됨) → 색 → 스트로크. 되돌리기 기록은 초기화된다.
 * @param {import('./clay.js').Clay} clay
 * @param {import('./character.js').Character} character
 */
export function applyPreset(clay, character, preset, { keepColor = false } = {}) {
  character.clearParts();
  clay.setBase(preset.base ?? D);
  clay.painted.fill(0);
  if (!keepColor && preset.color) clay.setColor(preset.color);
  clay.reset();
  clay.undoStack.length = 0; clay.redoStack.length = 0;
  for (const st of preset.strokes ?? []) clay.stroke(st);
  clay._commit();
}

/** 정면 2D 좌표(-1..1)로 파츠 얹기 — 프리셋/자동 빚기 공통 */
export function placeParts(character, parts) {
  for (const p of parts) {
    const anchor = character.anchorOnFront(p.x, p.y);
    character.addPart({ type: p.type, style: p.style, color: p.color, scale: p.scale ?? 1, rotation: p.rotation ?? 0, anchor });
  }
}

export { THREE };
