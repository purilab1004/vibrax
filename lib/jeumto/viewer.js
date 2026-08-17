// lib/jeumto/viewer.js — 저장된 점토 캐릭터를 보여주기만 하는 뷰어 (프로필 미니뷰, 게임 내 BJ).
// 에디터의 조명/카메라 느낌을 가볍게 재현하고, 말하기(입 비즘 리듬 + 머리 까딱)·눈 깜빡임 idle 을 돌린다.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Clay } from './clay.js';
import { Character } from './character.js';

const VISEME_SEQ = ['open', 'oh', 'rest', 'open', 'oh', 'oh', 'rest', 'open', 'rest', 'oh', 'open', 'rest'];

/**
 * @param {HTMLElement} container  크기를 가진 엘리먼트. 안에 canvas 를 만든다.
 * @param {{ interactive?: boolean, shadows?: boolean }} [opts]
 */
export function createJeumtoViewer(container, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;';
  container.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = !!opts.shadows;

  const scene = new THREE.Scene();
  const BASE_DIST = 5.2;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.5, BASE_DIST);
  const target = new THREE.Vector3(0, 0.15, 0);
  camera.lookAt(target);

  scene.add(new THREE.HemisphereLight('#ffffff', '#1a1a1f', 0.45));
  const key = new THREE.DirectionalLight('#fff4ea', 2.2); key.position.set(2.5, 4, 3.5); scene.add(key);
  const fill = new THREE.DirectionalLight('#cfe0ff', 0.7); fill.position.set(-3, 1, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffffff', 1.1); rim.position.set(-1.5, 2.5, -4); scene.add(rim);
  const point = new THREE.PointLight('#ffe9d6', 5, 12, 2); point.position.set(1.5, 2, 2.5); scene.add(point);

  const clay = new Clay();
  const character = new Character(clay);
  clay.mesh.castShadow = clay.mesh.receiveShadow = false;
  scene.add(character.root);

  let controls = null;
  if (opts.interactive) {
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = 0.4;
    controls.maxPolarAngle = Math.PI - 0.4;
    controls.target.copy(target);
  }

  // ---- talk / idle ----
  let talk = null;      // { t0, dur, mouth, restStyle, restScale, cur, step }
  let speakingUntil = 0;
  const findMouth = () => { const o = character.partsGroup.getObjectByName('mouth'); return o ? character.findPartByObject(o) : null; };
  const findEyes = () => ['eye_L', 'eye_R', 'eye_C'].map((n) => character.partsGroup.getObjectByName(n)).filter(Boolean);
  function setViseme(v) {
    const m = talk.mouth;
    if (v === 'rest') character.restyle(m, { style: talk.restStyle, scale: talk.restScale });
    else if (v === 'oh') character.restyle(m, { style: 'oh', scale: talk.restScale * 1.15 });
    else character.restyle(m, { style: 'open', scale: talk.restScale * 1.05 });
    talk.cur = v;
  }
  function beginTalk(now) {
    const mouth = findMouth();
    if (!mouth) return;
    talk = { t0: now, mouth, restStyle: mouth.style, restScale: mouth.scale, cur: 'rest', step: -1 };
  }
  function endTalk() {
    if (!talk) return;
    setViseme('rest');
    talk = null;
    character.root.rotation.set(0, 0, 0);
  }
  function tick(now) {
    const speaking = now < speakingUntil;
    if (speaking && !talk) beginTalk(now);
    if (!speaking && talk) endTalk();
    const t = now / 1000;
    if (talk) {
      const tt = (now - talk.t0) / 1000;
      const step = Math.floor(tt * 7);
      if (step !== talk.step) { talk.step = step; setViseme(VISEME_SEQ[step % VISEME_SEQ.length]); }
      if (talk.cur !== 'rest') {
        const ph = (tt * 7) % 1;
        const w = 0.75 + 0.35 * Math.sin(ph * Math.PI);
        const base = talk.mouth.object.scale.x;
        talk.mouth.object.scale.set(base, base * w, base);
      }
      character.root.rotation.z = Math.sin(tt * 3) * 0.03;
      character.root.rotation.x = Math.sin(tt * 5) * 0.02;
    } else {
      // idle: 아주 느린 숨쉬기 + 살짝 좌우 흔들림
      character.root.rotation.y = Math.sin(t * 0.6) * 0.06;
      character.root.position.y = Math.sin(t * 1.4) * 0.015;
    }
    // blink (idle/talk 공통) — 약 3.4초마다 0.12초
    const blink = t % 3.4 < 0.12 ? 0.08 : 1;
    for (const e of findEyes()) e.scale.y = e.scale.x * blink;
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // 세로로 긴 박스에서도 머리 전체가 보이도록 카메라 거리를 가로 비율에 맞춰 뒤로 뺀다
    const dist = BASE_DIST / Math.min(1, camera.aspect / 0.85);
    const dir = camera.position.clone().sub(target).normalize();
    camera.position.copy(target).addScaledVector(dir, dist);
    if (!controls) camera.lookAt(target);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  renderer.setAnimationLoop((now) => {
    tick(now);
    controls?.update();
    renderer.render(scene, camera);
  });

  /** 정면(+Z) 표면에서 (x,y) 에 가장 가까운 정점을 포함한 삼각형 → 앵커 */
  function anchorOnFront(x, y) {
    const pos = clay.positions;
    let best = 0, bd = Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) < 0.6) continue;
      const d = (pos.getX(i) - x) ** 2 + (pos.getY(i) - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    const idx = clay.geometry.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      if (idx[i] === best) return { face: [idx[i], idx[i + 1], idx[i + 2]], bary: [1, 0, 0] };
      if (idx[i + 1] === best) return { face: [idx[i], idx[i + 1], idx[i + 2]], bary: [0, 1, 0] };
      if (idx[i + 2] === best) return { face: [idx[i], idx[i + 1], idx[i + 2]], bary: [0, 0, 1] };
    }
    return { face: [idx[0], idx[1], idx[2]], bary: [1, 0, 0] };
  }
  /** 저장된 아바타가 없을 때 쓰는 기본 점토 얼굴 (눈 둘 + 웃는 입 + 볼터치) */
  function loadDefault(color = '#7fd8e6') {
    character.clearParts();
    clay.deserialize({ color });
    character.name = '기본 점토';
    character.addPart({ type: 'eye', style: 'round', color: '#2b2b2b', scale: 0.9, anchor: anchorOnFront(-0.42, 0.35) });
    character.addPart({ type: 'eye', style: 'round', color: '#2b2b2b', scale: 0.9, anchor: anchorOnFront(0.42, 0.35) });
    character.addPart({ type: 'mouth', style: 'smile', color: '#c0392b', scale: 0.9, anchor: anchorOnFront(0, -0.35) });
    character.addPart({ type: 'extra', style: 'blush', color: '#ff8fa3', scale: 0.8, anchor: anchorOnFront(-0.7, -0.05) });
    character.addPart({ type: 'extra', style: 'blush', color: '#ff8fa3', scale: 0.8, anchor: anchorOnFront(0.7, -0.05) });
  }

  /** 투명 배경 정사각 스냅샷 (프리뷰 PNG 용). idle 애니메이션 자세는 잠시 초기화한다. */
  function snapshot(size = 512, { blink = false, talk = false } = {}) {
    const eyes = blink ? findEyes().map((e) => [e, e.scale.y]) : [];
    for (const [e] of eyes) e.scale.y = e.scale.x * 0.08;
    let restoreMouth = null;
    if (talk) {
      const m = findMouth();
      if (m) { const style = m.style, scale = m.scale; character.restyle(m, { style: 'open', scale: scale * 1.05 }); restoreMouth = () => character.restyle(m, { style, scale }); }
    }
    const rot = character.root.rotation.clone(), posY = character.root.position.y;
    character.root.rotation.set(0, 0, 0); character.root.position.y = 0;
    const cam = camera.clone(); cam.aspect = 1; cam.updateProjectionMatrix();
    cam.position.set(0, 0.5, BASE_DIST * 1.12); cam.lookAt(target);
    const w = renderer.domElement.width, h = renderer.domElement.height;
    const sq = Math.max(256, Math.min(w, h));
    renderer.setSize(sq, sq, false);
    renderer.render(scene, cam);
    const src = renderer.domElement;
    const out = document.createElement('canvas');
    const s = sq * 0.95;
    out.width = out.height = size;
    out.getContext('2d').drawImage(src, (sq - s) / 2, (sq - s) / 2, s, s, 0, 0, size, size);
    renderer.setSize(w, h, false);
    character.root.rotation.copy(rot); character.root.position.y = posY;
    for (const [e, y] of eyes) e.scale.y = y;
    restoreMouth?.();
    return out;
  }

  return {
    character, clay, scene, camera,
    snapshot,
    /** character.serialize() 형태의 데이터를 로드 */
    load(data) { character.load(data); },
    loadDefault,
    /** ms 동안 말하기 애니메이션 */
    speak(ms) { speakingUntil = performance.now() + Math.max(0, ms); },
    stop() { speakingUntil = 0; },
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls?.dispose();
      character.clearParts();
      clay.geometry.dispose(); clay.material.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
