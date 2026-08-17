// lib/jeumto/toon.js — 플랫한 카툰(셀) 셰이딩. 3~4단계 그라데이션 + 큼직한 부드러운 하이라이트 방울.
// "현실적인 점토"보다 스티커/이모티콘 같은 파스텔 캐릭터 느낌을 낸다.
import * as THREE from 'three';

let _gradient = null;
export function toonGradient() {
  if (_gradient) return _gradient;
  // 어두운 면 → 밝은 면 (4단계). 첫 단계도 너무 어둡지 않게 → 파스텔 유지
  const data = new Uint8Array([178, 208, 242, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  _gradient = tex;
  return tex;
}

/** 부드러운 스펙큘러 "방울" 하이라이트를 toon 셰이더에 얹는다 */
function addGlossBlob(material, { strength = 0.5, size = 22, edge = 0.18 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGloss = { value: strength };
    shader.uniforms.uGlossPow = { value: size };
    shader.uniforms.uGlossEdge = { value: edge };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uGloss; uniform float uGlossPow; uniform float uGlossEdge;`)
      .replace('#include <opaque_fragment>', `
{
  // 뷰 공간 고정 광원(왼쪽 위 앞) 기준 블린-퐁 → 넓고 부드러운 원형 하이라이트
  vec3 L = normalize(vec3(-0.85, 0.8, 0.55));
  vec3 V = normalize(vViewPosition);
  vec3 H = normalize(L + V);
  float sp = pow(max(dot(normalize(normal), H), 0.0), uGlossPow);
  float blob = smoothstep(0.5 - uGlossEdge, 0.5 + uGlossEdge, sp);
  outgoingLight = mix(outgoingLight, vec3(1.0), blob * uGloss);
}
#include <opaque_fragment>`);
  };
  material.needsUpdate = true;
  return material;
}

/** 점토용 toon 머티리얼 (정점 색 사용) */
export function makeClayMaterial() {
  const m = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: toonGradient() });
  return addGlossBlob(m, { strength: 0.8, size: 9, edge: 0.14 });
}

/** 파츠용 toon 머티리얼 (단색) */
export function makePartMaterial(color, extra = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
  return addGlossBlob(m, { strength: 0.35, size: 30, edge: 0.15 });
}
