// lib/jeumto/editor.js — 점토(jeumto) 에디터. ~/Documents/jeumto/src/main.js 를 vibrax 안에서
// 컴포넌트로 쓸 수 있게 포팅한 것: 전역 document 대신 root 안에서만 DOM을 찾고, dispose()로 정리한다.
// 마크업은 ./markup.js 의 EDITOR_HTML(root.innerHTML)과 짝을 이룬다.
// 저장(서버)은 여기서 하지 않는다 — 호스트(React 페이지)가 api.character.serialize()/api.snapshot()을 쓴다.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Clay } from './clay.js';
import { Character } from './character.js';
import { PART_TYPES, iconSvg, buildPart } from './parts.js';
import { PRESETS, PRESET_BY_ID, applyPreset, placeParts } from './presets.js';

export const CLAY_COLORS = ['#7fd8e6', '#f9a8c9', '#ffd166', '#a5e887', '#b39ddb', '#ff9f7a', '#8fb8ff', '#5ec9b0', '#ffb3c6', '#f2f2f2', '#c9a27e', '#3d3d4a'];
const PAINT_COLORS = ['#ffffff', '#1c1c1e', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#30b0c7', '#007aff', '#af52de', '#ff2d55', '#a2845e', '#8e8e93'];

function downloadBlob(filename, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * @param {HTMLElement} root  EDITOR_HTML 이 들어있는 엘리먼트 (.jeumto)
 * @param {{ onDirty?: () => void, onRevert?: () => void }} [opts]
 */
export function createJeumtoEditor(root, opts = {}) {
  const $ = (id) => root.querySelector('#' + id);
  const $$ = (sel) => root.querySelectorAll(sel);
  const cleanups = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); cleanups.push(() => el.removeEventListener(ev, fn, o)); };

  // ---------- scene ----------
  const canvas = $('c');
  const viewport = $('viewport');
  const app = $('app');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0b0c');
  scene.fog = new THREE.Fog('#0b0b0c', 9, 22);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.7, 5.6);

  scene.add(new THREE.HemisphereLight('#ffffff', '#1a1a1f', 0.4));
  const key = new THREE.DirectionalLight('#fff4ea', 2.4);
  key.position.set(2.5, 4, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -3;
  key.shadow.camera.right = key.shadow.camera.top = 3;
  key.shadow.radius = 4;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#cfe0ff', 0.7);
  fill.position.set(-3, 1, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffffff', 1.2);
  rim.position.set(-1.5, 2.5, -4);
  scene.add(rim);
  const point = new THREE.PointLight('#ffe9d6', 6, 12, 2);
  point.position.set(1.5, 2, 2.5);
  scene.add(point);

  const FLOOR_Y = -1.45;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.ShadowMaterial({ opacity: 0.45 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR_Y;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(40, 80, '#3a3a40', '#232327');
  grid.position.y = FLOOR_Y - 0.001;
  grid.material.transparent = true;
  grid.material.opacity = 0.9;
  scene.add(grid);

  const clay = new Clay();
  const character = new Character(clay);
  scene.add(character.root);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2;
  controls.maxDistance = 14;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = Math.PI - 0.05;
  controls.enablePan = false;
  controls.target.set(0, 0.25, 0);

  const brushCursor = new THREE.Group();
  const fingerTip = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#d9734a', transparent: true, opacity: 0.9, depthWrite: false }),
  );
  const fingerRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 48), new THREE.MeshBasicMaterial({ color: '#d9734a' }));
  brushCursor.add(fingerTip, fingerRing);
  brushCursor.visible = false;
  scene.add(brushCursor);

  // ---------- state ----------
  const state = {
    mode: 'sculpt',
    paintColor: new THREE.Color('#ffffff'),
    paintSize: 0.25,
    paintFlow: 0.6,
    brush: 'push',
    brushSize: 0.45,
    brushStrength: 0.5,
    symmetry: false,
    partType: 'eye',
    partStyle: 'round',
    partColor: PART_TYPES.eye.defaultColor,
    partScale: 1,
    partRotation: 0,
    selected: null,
    dragging: null,
    sculpting: false,
    viewDrag: null,
    preview: null,
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);

  function updatePointer(e) {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }
  const hitClay = () => raycaster.intersectObject(clay.mesh, false)[0] || null;
  const hitParts = () => raycaster.intersectObjects(character.partsGroup.children, true)[0] || null;
  function mirroredAnchor(hit) {
    const local = clay.mesh.worldToLocal(hit.point.clone());
    const n = hit.face.normal.clone();
    local.x = -local.x; n.x = -n.x;
    const origin = clay.mesh.localToWorld(local.clone().addScaledVector(n, 1.5));
    const dir = clay.mesh.localToWorld(local.clone()).sub(origin).normalize();
    const rc = new THREE.Raycaster(origin, dir);
    const h = rc.intersectObject(clay.mesh, false)[0];
    return h ? character.anchorFromHit(h) : null;
  }

  // ---------- modes ----------
  const MODE_HINTS = {
    sculpt: '빚기 — 점토를 누르거나 드래그해요. 꾹 누르고 있을수록 깊게 들어가요.',
    paint: '칠하기 — 붓 색을 고르고 점토 위를 드래그해 칠해요.',
    place: '붙이기 — 파츠를 고르고 점토를 클릭해요. 붙은 파츠는 드래그로 옮기고, 선택 후 Delete로 지워요.',
  };
  function setMode(mode) {
    state.mode = mode;
    viewport.className = mode;
    $$('#mode-seg button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    $('mode-hint').textContent = MODE_HINTS[mode];
    $('sculpt-section').hidden = mode !== 'sculpt';
    $('paint-section').hidden = mode !== 'paint';
    $('parts-section').hidden = mode !== 'place';
    controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    brushCursor.visible = false;
    hidePreview();
    if (mode !== 'place') selectPart(null);
  }

  // ---------- sculpt ----------
  const BRUSH_COLORS = { push: '#ff7a59', pull: '#5aa9ff', inflate: '#ffd166', smooth: '#b8b8b8' };
  function placeCursor(hit) {
    brushCursor.visible = true;
    brushCursor.position.copy(hit.point);
    const n = hit.face.normal.clone().transformDirection(clay.mesh.matrixWorld);
    _m.lookAt(hit.point.clone().add(n), hit.point, UP);
    brushCursor.quaternion.setFromRotationMatrix(_m);
    const painting = state.mode === 'paint';
    const R = painting ? state.paintSize : state.brushSize;
    fingerRing.scale.setScalar(R);
    fingerTip.scale.setScalar(R * 0.12);
    if (painting) fingerTip.material.color.copy(state.paintColor);
    else fingerTip.material.color.set(BRUSH_COLORS[state.brush]);
    fingerRing.material.color.copy(fingerTip.material.color);
  }
  let sculptHit = null;
  function sculptTick(dt) {
    if (!state.sculpting || !sculptHit) return;
    dt = Math.min(dt, 0.05);
    const s = state.brushStrength;
    const local = clay.mesh.worldToLocal(sculptHit.point.clone());
    if (state.mode === 'paint') {
      clay.paintAt(local, state.paintSize, state.paintColor, (1 + 14 * state.paintFlow) * dt, state.symmetry);
      return;
    }
    const rate = { push: 0.15 + 0.85 * s, pull: 0.15 + 0.85 * s, inflate: 0.1 + 0.6 * s, smooth: 3 + 12 * s }[state.brush];
    clay.sculpt(local, sculptHit.face.normal, state.brush, state.brushSize, rate * dt, state.symmetry);
  }

  // ---------- place ----------
  function selectPart(part) {
    if (state.selected) { state.selected.setHighlight(false); partnerOf(state.selected)?.setHighlight(false); }
    state.selected = part;
    if (part) {
      part.setHighlight(true);
      partnerOf(part)?.setHighlight(true);
      state.partType = part.type; state.partStyle = part.style; state.partColor = part.color; state.partScale = part.scale;
      state.partRotation = part.rotation || 0;
      $('part-color').value = part.color;
      $('part-scale').value = part.scale;
      $('part-rotation').value = state.partRotation;
      $('part-rotation-val').textContent = `${state.partRotation}°`;
      renderPartTabs(); renderPartGrid();
    }
    $('delete-part').disabled = !part;
  }
  function partnerOf(part) {
    if (!part) return null;
    if (part.mirrorOf != null) return character.parts.get(part.mirrorOf) || null;
    for (const p of character.parts.values()) if (p.mirrorOf === part.id) return p;
    return null;
  }
  function placePartAt(hit) {
    const anchor = character.anchorFromHit(hit);
    const base = { type: state.partType, style: state.partStyle, color: state.partColor, scale: state.partScale, rotation: state.partRotation };
    if (PART_TYPES[state.partType].single) {
      const existing = [...character.parts.values()].find((p) => p.type === state.partType);
      if (existing) {
        existing.anchor = anchor;
        character.restyle(existing, base);
        character.relabel();
        selectPart(null);
        toast(`${PART_TYPES[state.partType].label}은(는) 하나만 — 기존 것을 옮겼어요`);
        return;
      }
    }
    const p = character.addPart({ ...base, anchor });
    if (state.symmetry && PART_TYPES[state.partType].mirror) {
      const ma = mirroredAnchor(hit);
      if (ma) character.addPart({ ...base, rotation: -state.partRotation, anchor: ma, mirrorOf: p.id });
    }
    selectPart(null);
    dirty();
  }
  function movePartTo(part, hit) {
    part.anchor = character.anchorFromHit(hit);
    character.seat(part);
    const partner = partnerOf(part);
    if (partner) {
      const ma = mirroredAnchor(hit);
      if (ma) { partner.anchor = ma; character.seat(partner); }
    }
    character.relabel();
    dirty();
  }
  function applyStyleToSelection() {
    const p = state.selected;
    if (!p) return;
    const o = { style: state.partStyle, color: state.partColor, scale: state.partScale, rotation: state.partRotation };
    if (p.type !== state.partType) return;
    character.restyle(p, o);
    const partner = partnerOf(p);
    if (partner) character.restyle(partner, { ...o, rotation: -state.partRotation });
    p.setHighlight(true); partner?.setHighlight(true);
    dirty();
  }
  function showPreview(hit) {
    if (!state.preview || state.preview.userData.key !== previewKey()) {
      hidePreview();
      const g = new THREE.Group();
      g.add(buildGhost());
      g.userData.key = previewKey();
      state.preview = g;
      scene.add(g);
    }
    const anchor = character.anchorFromHit(hit);
    character.evalAnchor(anchor, _v, _n);
    const g = state.preview;
    g.position.copy(clay.mesh.localToWorld(_v.clone()));
    _n.transformDirection(clay.mesh.matrixWorld);
    _m.lookAt(g.position.clone().add(_n), g.position, UP);
    g.quaternion.setFromRotationMatrix(_m);
    g.scale.setScalar(state.partScale);
    g.visible = true;
  }
  const previewKey = () => `${state.partType}/${state.partStyle}/${state.partColor}`;
  function buildGhost() {
    const inner = buildPart(state.partType, state.partStyle, state.partColor);
    inner.traverse((o) => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.5; o.castShadow = false; } });
    return inner;
  }
  function hidePreview() {
    if (state.preview) { scene.remove(state.preview); state.preview.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); state.preview = null; }
  }

  // ---------- pointer events ----------
  on(canvas, 'contextmenu', (e) => e.preventDefault());
  on(canvas, 'pointerdown', (e) => {
    if (e.button !== 0) return;
    updatePointer(e);
    if (state.mode === 'sculpt' || state.mode === 'paint') {
      const hit = hitClay();
      if (!hit) { startViewDrag(e); return; }
      state.sculpting = true;
      canvas.setPointerCapture(e.pointerId);
      clay.beginStroke();
      sculptHit = hit;
      placeCursor(hit);
    } else if (state.mode === 'place') {
      const ph = hitParts();
      if (ph) {
        const part = character.findPartByObject(ph.object);
        selectPart(part);
        state.dragging = { part, moved: false };
        canvas.setPointerCapture(e.pointerId);
        hidePreview();
        return;
      }
      const hit = hitClay();
      if (hit) placePartAt(hit);
      else { selectPart(null); startViewDrag(e); }
    }
  });
  on(canvas, 'pointermove', (e) => {
    updatePointer(e);
    if (state.viewDrag) { moveViewDrag(e); return; }
    if (state.mode === 'sculpt' || state.mode === 'paint') {
      const hit = hitClay();
      if (hit) { placeCursor(hit); if (state.sculpting) sculptHit = hit; }
      else { brushCursor.visible = false; sculptHit = null; }
    } else if (state.mode === 'place') {
      if (state.dragging) {
        const hit = hitClay();
        if (hit) { movePartTo(state.dragging.part, hit); state.dragging.moved = true; }
        return;
      }
      if (hitParts()) { hidePreview(); canvas.style.cursor = 'grab'; return; }
      canvas.style.cursor = '';
      const hit = hitClay();
      if (hit) showPreview(hit); else if (state.preview) state.preview.visible = false;
    }
  });
  function endPointer(e) {
    if (state.sculpting) { state.sculpting = false; sculptHit = null; clay.endStroke(); dirty(); }
    if (state.dragging) state.dragging = null;
    if (state.viewDrag) { state.viewDrag = null; viewport.classList.remove('grabbing'); }
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  // ---------- view ----------
  const _sph = new THREE.Spherical();
  function startViewDrag(e) {
    state.viewDrag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    viewport.classList.add('grabbing');
  }
  function moveViewDrag(e) {
    const dx = e.clientX - state.viewDrag.x, dy = e.clientY - state.viewDrag.y;
    state.viewDrag = { x: e.clientX, y: e.clientY };
    orbitBy((-dx / canvas.clientHeight) * Math.PI * 2, (-dy / canvas.clientHeight) * Math.PI * 2);
  }
  function orbitBy(dTheta, dPhi) {
    const off = camera.position.clone().sub(controls.target);
    _sph.setFromVector3(off);
    _sph.theta += dTheta;
    _sph.phi = THREE.MathUtils.clamp(_sph.phi + dPhi, 0.05, Math.PI - 0.05);
    camera.position.copy(controls.target).add(off.setFromSpherical(_sph));
    camera.lookAt(controls.target);
  }
  function resetView() {
    camera.position.set(0, 0.7, 5.6);
    controls.target.set(0, 0.25, 0);
    camera.lookAt(controls.target);
  }
  on(canvas, 'dblclick', (e) => { updatePointer(e); if (!hitClay() && !hitParts()) resetView(); });
  on(canvas, 'pointerup', endPointer);
  on(canvas, 'pointercancel', endPointer);
  on(canvas, 'pointerleave', () => { brushCursor.visible = false; if (state.preview) state.preview.visible = false; });

  on(window, 'keydown', (e) => {
    if (e.key === 'Escape') { selectPart(null); e.target.blur?.(); return; }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected) { character.removePart(state.selected.id); selectPart(null); dirty(); return; }
    if (e.key === 'h' || e.key === 'H') { setPanelCollapsed(!app.classList.contains('panel-collapsed')); return; }
    if (e.key === '1') setMode('sculpt');
    if (e.key === '2') setMode('paint');
    if (e.key === '3') setMode('place');
    if (e.key === '[') state.mode === 'paint' ? setPaintSize(state.paintSize - 0.05) : setBrushSize(state.brushSize - 0.05);
    if (e.key === ']') state.mode === 'paint' ? setPaintSize(state.paintSize + 0.05) : setBrushSize(state.brushSize + 0.05);
  });
  function doUndo() { if (!clay.undo()) toast('되돌릴 게 없어요'); else dirty(); }
  function doRedo() { if (!clay.redo()) toast('다시 할 게 없어요'); else dirty(); }
  function setPaintSize(v) { state.paintSize = THREE.MathUtils.clamp(v, 0.05, 1); $('paint-size').value = state.paintSize; }
  function setBrushSize(v) { state.brushSize = THREE.MathUtils.clamp(v, 0.1, 1.2); $('brush-size').value = state.brushSize; }

  // ---------- panel wiring ----------
  $$('#mode-seg button').forEach((b) => on(b, 'click', () => setMode(b.dataset.mode)));
  $$('#brush-seg button').forEach((b) => on(b, 'click', () => {
    state.brush = b.dataset.brush;
    $$('#brush-seg button').forEach((x) => x.classList.toggle('active', x === b));
    setMode('sculpt');
  }));
  on($('brush-size'), 'input', (e) => { state.brushSize = +e.target.value; });
  on($('brush-strength'), 'input', (e) => { state.brushStrength = +e.target.value; });
  on($('symmetry'), 'change', (e) => { state.symmetry = e.target.checked; });
  on($('undo'), 'click', doUndo);
  on($('redo'), 'click', doRedo);
  on($('reset-clay'), 'click', () => { clay.reset(); dirty(); toast('점토를 처음 모양으로 되돌렸어요'); });

  const swatchBox = $('clay-swatches');
  const clayColorInput = $('clay-color');
  function setClayColor(hex) {
    clay.setColor(hex);
    clayColorInput.value = hex;
    swatchBox.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.color === hex));
  }
  for (const c of CLAY_COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.background = c; b.dataset.color = c; b.title = c;
    b.addEventListener('click', () => { setClayColor(c); dirty(); });
    swatchBox.appendChild(b);
  }
  on(clayColorInput, 'input', (e) => { setClayColor(e.target.value); dirty(); });
  setClayColor(CLAY_COLORS[0]);

  const paintSwatchBox = $('paint-swatches');
  const paintColorInput = $('paint-color');
  function setPaintColor(hex) {
    state.paintColor.set(hex);
    paintColorInput.value = hex;
    paintSwatchBox.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.color === hex));
  }
  for (const c of PAINT_COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.background = c; b.dataset.color = c; b.title = c;
    b.addEventListener('click', () => setPaintColor(c));
    paintSwatchBox.appendChild(b);
  }
  on(paintColorInput, 'input', (e) => setPaintColor(e.target.value));
  setPaintColor(PAINT_COLORS[0]);
  on($('paint-size'), 'input', (e) => { state.paintSize = +e.target.value; });
  on($('paint-flow'), 'input', (e) => { state.paintFlow = +e.target.value; });
  on($('paint-undo'), 'click', doUndo);
  on($('paint-redo'), 'click', doRedo);
  on($('clear-paint'), 'click', () => { clay.clearPaint(); dirty(); toast('칠을 모두 지웠어요'); });

  function renderPartTabs() {
    const tabs = $('part-tabs');
    tabs.innerHTML = '';
    for (const [type, def] of Object.entries(PART_TYPES)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = def.label;
      b.classList.toggle('active', type === state.partType);
      b.addEventListener('click', () => {
        state.partType = type;
        state.partStyle = Object.keys(def.styles)[0];
        state.partColor = def.defaultColor;
        state.partRotation = 0;
        $('part-color').value = def.defaultColor;
        $('part-rotation').value = 0;
        $('part-rotation-val').textContent = '0°';
        selectPart(null);
        renderPartTabs(); renderPartGrid();
        setMode('place');
      });
      tabs.appendChild(b);
    }
  }
  function renderPartGrid() {
    const grid = $('part-grid');
    grid.innerHTML = '';
    const def = PART_TYPES[state.partType];
    for (const [style, s] of Object.entries(def.styles)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = iconSvg(s.icon);
      b.title = s.label;
      b.style.color = state.partColor;
      b.classList.toggle('active', style === state.partStyle);
      b.addEventListener('click', () => { state.partStyle = style; renderPartGrid(); applyStyleToSelection(); setMode('place'); });
      grid.appendChild(b);
    }
  }
  on($('part-color'), 'input', (e) => { state.partColor = e.target.value; renderPartGrid(); applyStyleToSelection(); });
  on($('part-scale'), 'input', (e) => { state.partScale = +e.target.value; applyStyleToSelection(); });
  on($('part-rotation'), 'input', (e) => {
    state.partRotation = +e.target.value;
    $('part-rotation-val').textContent = `${state.partRotation}°`;
    applyStyleToSelection();
  });
  on($('set-front'), 'click', () => {
    const off = camera.position.clone().sub(controls.target);
    const theta = Math.atan2(off.x, off.z);
    const q = Math.round(theta / (Math.PI / 2));
    if (((q % 4) + 4) % 4 === 0) { toast('이미 이 면이 정면이에요'); resetView(); return; }
    selectPart(null);
    clay.turnY(-q);
    character.afterClayTurn(-q);
    resetView();
    dirty();
    toast('이 면을 정면으로 설정했어요 (되돌리기 기록은 초기화)');
  });
  on($('delete-part'), 'click', () => { if (state.selected) { character.removePart(state.selected.id); selectPart(null); dirty(); } });
  on($('clear-parts'), 'click', () => { character.clearParts(); selectPart(null); dirty(); });
  renderPartTabs(); renderPartGrid();

  // ---------- shape presets / image import ----------
  const hasWork = () => character.parts.size || clay.undoStack.length || clay.painted.some((v) => v);
  let currentPreset = 'square';
  function renderPresets() {
    const box = $('presets');
    box.innerHTML = '';
    for (const pr of PRESETS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span class="em">${pr.emoji}</span><span>${pr.label}</span>`;
      b.classList.toggle('active', pr.id === currentPreset);
      b.addEventListener('click', () => {
        if (hasWork() && !confirm(`'${pr.label}' 모양으로 바꿀까요? 지금 빚은 형태·칠·파츠는 사라져요.`)) return;
        selectPreset(pr.id);
        toast(`'${pr.label}' 모양에서 시작해요`);
      });
      box.appendChild(b);
    }
  }
  function selectPreset(id, { keepColor = false } = {}) {
    const pr = PRESET_BY_ID[id] || PRESETS[0];
    selectPart(null);
    applyPreset(clay, character, pr, { keepColor });
    currentPreset = pr.id; character.presetId = pr.id;
    setClayColor(clay.getColor());
    renderPresets();
    resetView();
    setMode('sculpt');
    dirty();
  }
  on($('from-image'), 'change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (hasWork() && !confirm('사진을 바탕으로 새로 빚을까요? 지금 빚은 형태·칠·파츠는 사라져요.')) return;
    const btn = root.querySelector('.file-btn.primary');
    btn.classList.add('busy');
    toast('사진을 읽는 중… (몇 초 걸려요)');
    try {
      const { data, media_type } = await fileToBase64(f, 1024);
      const res = await fetch('/api/avatar/from-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: data, media_type }) });
      if (!res.ok) throw new Error(res.status === 401 ? '로그인이 필요해요' : `자동 빚기 실패 (${res.status})`);
      const recipe = await res.json();
      applyRecipe(recipe);
      toast(`'${recipe.name || '새 점토'}' — 사진을 바탕으로 빚었어요. 이어서 다듬어 보세요!`);
    } catch (err) {
      console.error('[jeumto] from-image', err);
      toast(err.message || '자동 빚기 실패');
    } finally { btn.classList.remove('busy'); }
  });
  /** 레시피({preset, clayColor, parts[], name}) → 점토에 적용 */
  function applyRecipe(recipe) {
    selectPreset(recipe.preset, { keepColor: true });
    if (recipe.clayColor) setClayColor(recipe.clayColor);
    placeParts(character, recipe.parts || []);
    if (recipe.name) { character.name = recipe.name; nameInput.value = recipe.name; }
    setMode('place');
    dirty();
  }
  /** 이미지 파일 → 긴 변 maxSize 로 줄인 JPEG base64 (업로드 크기 절약) */
  function fileToBase64(file, maxSize) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, maxSize / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ data: c.toDataURL('image/jpeg', 0.88).split(',')[1], media_type: 'image/jpeg' });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없어요')); };
      img.src = url;
    });
  }
  renderPresets();

  // ---------- character / io ----------
  const nameInput = $('char-name');
  on(nameInput, 'input', () => { character.name = nameInput.value; dirty(); });
  on($('new-char'), 'click', () => {
    if (character.parts.size || clay.undoStack.length || clay.painted.some((v) => v)) {
      if (!confirm('지금 작업 중인 점토를 지우고 기본 점토로 새로 시작할까요? (저장하지 않은 변경은 사라져요)')) return;
    }
    newCharacter();
    toast('기본 점토로 새로 시작해요');
  });
  function newCharacter() {
    selectPart(null);
    character.clearParts();
    clay.setBase(PRESETS[0].base);
    currentPreset = PRESETS[0].id; character.presetId = currentPreset; renderPresets();
    clay.painted.fill(0);
    clay.setColor(CLAY_COLORS[0]);
    clay.reset();
    clay.undoStack.length = 0; clay.redoStack.length = 0;
    character.name = '내 점토';
    nameInput.value = character.name;
    setClayColor(CLAY_COLORS[0]);
    resetView();
    setMode('sculpt');
    dirty();
  }

  /** 정사각형 스냅샷 캔버스 — 커서/선택 하이라이트/고스트는 숨기고 찍는다 */
  /** 모든 눈 파츠(eye_*)를 감은 모양(납작)으로 — 깜빡임 프레임 스냅샷용. 되돌리는 함수를 반환 */
  function closeEyes() {
    const eyes = [];
    character.partsGroup.traverse((o) => { if (/^eye_/.test(o.name)) eyes.push([o, o.scale.y]); });
    for (const [o] of eyes) o.scale.y = o.scale.x * 0.08;
    return () => { for (const [o, y] of eyes) o.scale.y = y; };
  }
  /** 입(mouth) 파츠를 벌린 모양(open)으로 — 말하기 프레임 스냅샷용. 되돌리는 함수를 반환 */
  function openMouth() {
    const mo = character.partsGroup.getObjectByName('mouth');
    const m = mo && character.findPartByObject(mo);
    if (!m) return null;
    const style = m.style, scale = m.scale;
    character.restyle(m, { style: 'open', scale: scale * 1.05 });
    return () => character.restyle(m, { style, scale });
  }
  function snapshot(size = 512, { blink = false, talk = false } = {}) {
    const restoreEyes = blink ? closeEyes() : null;
    const restoreMouth = talk ? openMouth() : null;
    const wasCursor = brushCursor.visible; brushCursor.visible = false;
    const wasSel = state.selected; if (wasSel) { wasSel.setHighlight(false); partnerOf(wasSel)?.setHighlight(false); }
    const prev = state.preview; if (prev) prev.visible = false;
    // 프리뷰는 배경 없이(투명 PNG) 캐릭터만 — 프로필 원 밖으로 튀어나오게 보여주기 위해
    const bg = scene.background, fog = scene.fog;
    scene.background = null; scene.fog = null; ground.visible = false; grid.visible = false;
    // 카메라 종횡비는 그대로 두고(바꾸면 찌그러짐) 가운데 정사각형만 잘라낸다. 귀·뿔이 잘리지 않게 살짝 뒤로.
    const cam = camera.clone();
    cam.position.sub(controls.target).multiplyScalar(1.15).add(controls.target);
    cam.lookAt(controls.target);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, cam);
    const src = renderer.domElement;
    const out = document.createElement('canvas');
    // 캐릭터를 꽉 채우도록 중앙을 좀 더 타이트하게 잘라낸다
    const s = Math.min(src.width, src.height) * 0.98;
    out.width = out.height = size;
    out.getContext('2d').drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, size, size);
    scene.background = bg; scene.fog = fog; ground.visible = true; grid.visible = true;
    restoreEyes?.(); restoreMouth?.();
    brushCursor.visible = wasCursor;
    if (wasSel) { wasSel.setHighlight(true); partnerOf(wasSel)?.setHighlight(true); }
    return out;
  }
  const safeName = () => (character.name || 'jeumto').replace(/[\\/:*?"<>|]/g, '_');
  on($('download-json'), 'click', () => {
    const data = character.serialize();
    data.thumbnail = snapshot(256).toDataURL('image/png');
    downloadBlob(`${safeName()}.jeumto.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
  });
  on($('download-png'), 'click', () => { snapshot(1024).toBlob((b) => downloadBlob(`${safeName()}.png`, b), 'image/png'); });
  on($('load-json'), 'change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      loadCharacterData(JSON.parse(await f.text()));
      toast(`'${character.name}' 불러왔어요`);
    } catch (err) { toast(err.message || '불러오기 실패'); }
    e.target.value = '';
  });
  function loadCharacterData(data) {
    selectPart(null);
    character.load(data);
    currentPreset = data.preset || null; renderPresets();
    nameInput.value = character.name;
    setClayColor(clay.getColor());
    resetView();
  }

  // ---------- talk test ----------
  let talk = null;
  const VISEME_SEQ = ['open', 'oh', 'rest', 'open', 'oh', 'oh', 'rest', 'open', 'rest', 'oh', 'open', 'rest'];
  on($('talk-test'), 'click', () => {
    if (talk) return;
    const mouthObj = character.partsGroup.getObjectByName('mouth');
    const mouth = mouthObj && character.findPartByObject(mouthObj);
    const eyes = ['eye_L', 'eye_R'].map((n) => character.partsGroup.getObjectByName(n)).filter(Boolean);
    if (!mouth) { toast('입을 먼저 붙여 주세요'); return; }
    selectPart(null);
    talk = { t0: performance.now(), dur: 3200, mouth, eyes, restStyle: mouth.style, restScale: mouth.scale, cur: 'rest', step: -1 };
  });
  function setViseme(v) {
    const m = talk.mouth;
    if (v === 'rest') character.restyle(m, { style: talk.restStyle, scale: talk.restScale });
    else if (v === 'oh') character.restyle(m, { style: 'oh', scale: talk.restScale * 1.15 });
    else character.restyle(m, { style: 'open', scale: talk.restScale * 1.05 });
    talk.cur = v;
  }
  function updateTalk(now) {
    if (!talk) return;
    const t = (now - talk.t0) / 1000;
    if (now - talk.t0 > talk.dur) {
      setViseme('rest');
      for (const e of talk.eyes) e.scale.y = e.scale.x;
      character.root.rotation.set(0, 0, 0);
      talk = null; return;
    }
    const step = Math.floor(t * 7);
    if (step !== talk.step) { talk.step = step; setViseme(VISEME_SEQ[step % VISEME_SEQ.length]); }
    if (talk.cur !== 'rest') {
      const ph = (t * 7) % 1;
      const w = 0.75 + 0.35 * Math.sin(ph * Math.PI);
      const base = talk.mouth.object.scale.x;
      talk.mouth.object.scale.set(base, base * w, base);
    }
    const blink = t % 1.4 < 0.12 ? 0.08 : 1;
    for (const e of talk.eyes) e.scale.y = e.scale.x * blink;
    character.root.rotation.z = Math.sin(t * 3) * 0.03;
    character.root.rotation.x = Math.sin(t * 5) * 0.02;
  }

  // ---------- misc ----------
  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }
  function dirty() { opts.onDirty?.(); }
  function resize() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(viewport);
  cleanups.push(() => ro.disconnect());
  const panelToggle = $('panel-toggle');
  function setPanelCollapsed(on) {
    app.classList.toggle('panel-collapsed', on);
    panelToggle.textContent = on ? '▶' : '◀';
    resize();
  }
  on(panelToggle, 'click', () => setPanelCollapsed(!app.classList.contains('panel-collapsed')));
  // 좁은 화면(모바일)은 패널을 접은 채 시작
  setPanelCollapsed(root.clientWidth < 720);
  resize();
  const updateStats = () => { $('stats').textContent = `vertex ${clay.vertexCount.toLocaleString()} · faces ${clay.faceCount.toLocaleString()}`; };
  const prevRebuild = clay.onRebuild; clay.onRebuild = () => { prevRebuild?.(); updateStats(); };
  updateStats();
  setMode('sculpt');

  let lastNow = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = (now - lastNow) / 1000; lastNow = now;
    sculptTick(dt);
    controls.update();
    updateTalk(now);
    renderer.render(scene, camera);
  });

  function dispose() {
    renderer.setAnimationLoop(null);
    for (const c of cleanups.splice(0)) c();
    controls.dispose();
    hidePreview();
    character.clearParts();
    clay.geometry.dispose(); clay.material.dispose();
    renderer.dispose();
  }

  // 호스트가 저장본 되돌리기를 연결할 수 있게 패널 버튼을 노출
  const revertBtn = $('revert-saved');
  on(revertBtn, 'click', () => opts.onRevert?.());

  return {
    character, clay, state, renderer, scene,
    setHasSaved(v) { revertBtn.disabled = !v; },
    snapshot, loadCharacterData, newCharacter, setMode, toast, dispose, applyRecipe, selectPreset,
    get name() { return character.name; },
    setName(n) { character.name = n; nameInput.value = n; },
  };
}
