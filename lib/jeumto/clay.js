// Clay: a densely, uniformly tessellated rounded box that can be sculpted with
// push / pull / inflate / smooth brushes, with undo/redo and compact serialization.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeClayMaterial } from './toon.js';

export const CLAY_DEFAULTS = { width: 2, height: 2.4, depth: 1.8, radius: 0.6, density: 40 };
const MAX_HISTORY = 30;
const MAX_OFFSET = 1.5; // max distance any vertex may travel from the base shape (귀·뿔 프리셋을 위해 넉넉히)
const Q = 10000;        // quantization for saved offsets (Int16, ±3.27 units)
const SRGB_LUT = Float32Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });

/**
 * Build a rounded box whose vertices are spread evenly over the whole surface
 * (three's RoundedBoxGeometry only subdivides the corners, leaving flat faces empty —
 * useless for sculpting). Start from a uniformly segmented box, then round every
 * vertex onto the rounded-box surface via the inner-box projection.
 */
export function makeClayGeometry({ width, height, depth, radius, density }) {
  const seg = (s) => Math.max(2, Math.round(s * density));
  const box = new THREE.BoxGeometry(width, height, depth, seg(width), seg(height), seg(depth));
  box.deleteAttribute('uv');
  box.deleteAttribute('normal');
  const g = mergeVertices(box, 1e-5);
  const pos = g.attributes.position;
  const half = new THREE.Vector3(width / 2, height / 2, depth / 2);
  const inner = half.clone().subScalar(radius);
  const v = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(
      THREE.MathUtils.clamp(v.x, -inner.x, inner.x),
      THREE.MathUtils.clamp(v.y, -inner.y, inner.y),
      THREE.MathUtils.clamp(v.z, -inner.z, inner.z),
    );
    d.subVectors(v, c);
    if (d.lengthSq() > 0) v.copy(c).addScaledVector(d.normalize(), radius);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export class Clay {
  constructor(color = '#7fd8e6', base = CLAY_DEFAULTS) {
    // Colour = per-vertex paint (RGB bytes) × cavity shade. The material itself stays white.
    this.material = makeClayMaterial();
    this.baseColor = new THREE.Color(color);
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.name = 'clay';
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.undoStack = [];
    this.redoStack = [];
    this._strokeSnapshot = null;
    this.onChange = null; // callback after geometry changes (used to re-seat parts)
    this.onRebuild = null; // callback after the base shape (topology) changes — parts must be dropped
    this._build(base);
  }

  /** (Re)build the base geometry with the given dimensions. Clears paint/offsets/history. */
  _build(base) {
    this.base = { ...CLAY_DEFAULTS, ...base };
    if (this.geometry) this.geometry.dispose();
    this.geometry = makeClayGeometry(this.base);
    this.mesh.geometry = this.geometry;
    this.basePositions = Float32Array.from(this.geometry.attributes.position.array);
    this.neighbors = buildAdjacency(this.geometry);
    const n = this.vertexCount;
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.paint = new Uint8Array(n * 3);   // per-vertex paint colour
    this.painted = new Uint8Array(n);     // 1 = touched by the paint brush (keeps colour when base colour changes)
    this._shade = new Float32Array(n).fill(1);
    this._cavityTmp = new Float32Array(n);
    this._edgeLen = averageEdgeLength(this.geometry);
    this._fillPaint(this.baseColor, false);
    this._computeCavity();
    this._updateColors();
    this.undoStack.length = 0; this.redoStack.length = 0;
    this._strokeSnapshot = null;
  }
  /** Change the base shape (width/height/depth/radius). Topology changes → parts are invalid → onRebuild. */
  setBase(base) {
    const b = { ...CLAY_DEFAULTS, ...base };
    if (['width', 'height', 'depth', 'radius', 'density'].every((k) => Math.abs(b[k] - this.base[k]) < 1e-6)) return false;
    this._build(b);
    this.onRebuild?.();
    this._commit();
    return true;
  }
  /** Sculpt programmatically (presets): `steps` brush ticks at a local point along `dir`. */
  stroke({ brush = 'pull', at, dir = [0, 1, 0], radius = 0.4, amount = 0.05, steps = 10, symmetry = false, advance = 0 }) {
    const p = new THREE.Vector3(...at), n = new THREE.Vector3(...dir).normalize();
    for (let i = 0; i < steps; i++) {
      this.sculpt(p, n, brush, radius, amount, symmetry);
      if (advance) p.addScaledVector(n, advance); // 브러시 중심이 끝을 따라가며 길게 뽑아낸다(귀·뿔)
    }
  }

  get positions() { return this.geometry.attributes.position; }
  get normals() { return this.geometry.attributes.normal; }
  get vertexCount() { return this.positions.count; }
  get faceCount() { return this.geometry.index.count / 3; }

  /** Base clay colour: recolours every vertex the paint brush has not touched. */
  setColor(hex) { this.baseColor.set(hex); this._fillPaint(this.baseColor, false); this._updateColors(); }
  getColor() { return '#' + this.baseColor.getHexString(); }
  /** Wipe all paint back to the base colour. */
  clearPaint() { this._snapshotAsUndo(); this._fillPaint(this.baseColor, true); this._updateColors(); }
  _fillPaint(color, includePainted) {
    const r = Math.round(color.r * 255), g = Math.round(color.g * 255), b = Math.round(color.b * 255);
    for (let v = 0, i = 0; v < this.painted.length; v++, i += 3) {
      if (!includePainted && this.painted[v]) continue;
      this.paint[i] = r; this.paint[i + 1] = g; this.paint[i + 2] = b;
      if (includePainted) this.painted[v] = 0;
    }
  }
  _updateColors() {
    const col = this.geometry.attributes.color.array, p = this.paint, sh = this._shade;
    for (let v = 0, i = 0; v < sh.length; v++, i += 3) {
      const s = sh[v];
      // sRGB 바이트 → 리니어 (three 는 정점 색을 리니어로 취급) → 고른 색이 화면에서 그대로 보인다
      col[i] = SRGB_LUT[p[i]] * s; col[i + 1] = SRGB_LUT[p[i + 1]] * s; col[i + 2] = SRGB_LUT[p[i + 2]] * s;
    }
    this.geometry.attributes.color.needsUpdate = true;
  }

  // ---- history (positions + paint together) ----
  _snap() { return { pos: Float32Array.from(this.positions.array), paint: Uint8Array.from(this.paint), painted: Uint8Array.from(this.painted) }; }
  _snapshotAsUndo() {
    this.undoStack.push(this._snap());
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack.length = 0;
  }
  beginStroke() { this._strokeSnapshot = this._snap(); }
  endStroke() {
    if (!this._strokeSnapshot) return;
    this.undoStack.push(this._strokeSnapshot);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack.length = 0;
    this._strokeSnapshot = null;
  }
  undo() {
    const s = this.undoStack.pop();
    if (!s) return false;
    this.redoStack.push(this._snap());
    this._apply(s);
    return true;
  }
  redo() {
    const s = this.redoStack.pop();
    if (!s) return false;
    this.undoStack.push(this._snap());
    this._apply(s);
    return true;
  }
  reset() {
    this._snapshotAsUndo();
    this._apply({ pos: this.basePositions });
  }
  _apply(snap) {
    this.positions.array.set(snap.pos);
    if (snap.paint) { this.paint.set(snap.paint); this.painted.set(snap.painted); }
    this._commit();
  }
  _commit() {
    this.positions.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this._computeCavity();
    this._updateColors();
    this.onChange?.();
  }

  /**
   * Turn the whole clay by quarterTurns × 90° around Y and bake it into the vertices (both current
   * and base positions, so sculpt offsets and mirror symmetry stay consistent). History is cleared.
   */
  turnY(quarterTurns) {
    const k = ((quarterTurns % 4) + 4) % 4;
    if (!k) return;
    const a = k * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a);
    for (const arr of [this.positions.array, this.basePositions]) {
      for (let i = 0; i < arr.length; i += 3) {
        const x = arr[i], z = arr[i + 2];
        arr[i] = x * c + z * sn;
        arr[i + 2] = -x * sn + z * c;
      }
    }
    this.undoStack.length = 0; this.redoStack.length = 0;
    this._commit();
  }

  // ---- painting ----
  /**
   * Blend `color` (THREE.Color) into the paint layer under the brush. `amount` is flow × dt.
   */
  paintAt(point, radius, color, amount, symmetry) {
    const centers = [point];
    if (symmetry && Math.abs(point.x) > 1e-4) centers.push(new THREE.Vector3(-point.x, point.y, point.z));
    const pos = this.positions.array, p = this.paint;
    const r2 = radius * radius;
    const cr = color.r * 255, cg = color.g * 255, cb = color.b * 255;
    for (const c of centers) {
      const minX = c.x - radius, maxX = c.x + radius, minY = c.y - radius, maxY = c.y + radius, minZ = c.z - radius, maxZ = c.z + radius;
      for (let i = 0, v = 0; i < pos.length; i += 3, v++) {
        const x = pos[i], y = pos[i + 1], z = pos[i + 2];
        if (x < minX || x > maxX || y < minY || y > maxY || z < minZ || z > maxZ) continue;
        const dx = x - c.x, dy = y - c.y, dz = z - c.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r2) continue;
        const t = 1 - d2 / r2;
        const k = Math.min(1, t * t * (3 - 2 * t) * amount);
        p[i] += (cr - p[i]) * k; p[i + 1] += (cg - p[i + 1]) * k; p[i + 2] += (cb - p[i + 2]) * k;
        this.painted[v] = 1;
      }
    }
    this._updateColors();
  }

  /**
   * Cavity term per vertex: signed distance of the neighbour average from the tangent plane
   * (Laplacian · normal), normalised by edge length. Positive = concave (crease) → darker,
   * negative = convex (ridge) → slightly brighter. Cheap enough to run every sculpt frame.
   */
  _computeCavity() {
    const pos = this.positions.array, nor = this.normals.array;
    const invH = 1 / this._edgeLen;
    const DARK = 0.22, BRIGHT = 0.06; // strength of darkening / brightening (플랫 룩이라 은은하게)
    const n = pos.length / 3;
    const k = this._cavityTmp, shade = this._shade;
    for (let i = 0, v = 0; i < pos.length; i += 3, v++) {
      const nb = this.neighbors[v];
      let ax = 0, ay = 0, az = 0;
      for (const j of nb) { ax += pos[j * 3]; ay += pos[j * 3 + 1]; az += pos[j * 3 + 2]; }
      const inv = 1 / nb.length;
      const lx = ax * inv - pos[i], ly = ay * inv - pos[i + 1], lz = az * inv - pos[i + 2];
      k[v] = (lx * nor[i] + ly * nor[i + 1] + lz * nor[i + 2]) * invH; // >0 concave
    }
    // one blur pass over neighbours to hide per-vertex noise on stretched areas
    for (let v = 0; v < n; v++) {
      const nb = this.neighbors[v];
      let s = k[v];
      for (const j of nb) s += k[j];
      const kk = s / (nb.length + 1);
      shade[v] = kk > 0 ? 1 - Math.min(1, kk * 8) * DARK : 1 + Math.min(1, -kk * 8) * BRIGHT;
    }
  }

  // ---- sculpting ----
  /**
   * Apply one brush step. Call once per animation frame while the pointer is held; `amount`
   * should already be scaled by frame time so the result is device-independent.
   *   push    – move clay away from the finger, along the brush-center normal
   *   pull    – move clay toward the finger, along the brush-center normal
   *   inflate – move each vertex along its own normal (puffs the region up)
   *   smooth  – relax vertices toward their neighbours' average
   * @param {THREE.Vector3} point   local-space brush center on the surface
   * @param {THREE.Vector3} normal  local-space surface normal at the brush center
   */
  sculpt(point, normal, brush, radius, amount, symmetry) {
    const centers = [[point, normal.clone().normalize()]];
    if (symmetry && Math.abs(point.x) > 1e-4) {
      centers.push([new THREE.Vector3(-point.x, point.y, point.z), new THREE.Vector3(-normal.x, normal.y, normal.z).normalize()]);
    }
    const pos = this.positions.array;
    const nor = this.normals.array;
    const base = this.basePositions;
    const r2 = radius * radius;
    const src = brush === 'smooth' ? Float32Array.from(pos) : null;
    for (const [c, dir] of centers) {
      // cheap bounding-box reject before the sphere test
      const minX = c.x - radius, maxX = c.x + radius, minY = c.y - radius, maxY = c.y + radius, minZ = c.z - radius, maxZ = c.z + radius;
      for (let i = 0; i < pos.length; i += 3) {
        const x = pos[i], y = pos[i + 1], z = pos[i + 2];
        if (x < minX || x > maxX || y < minY || y > maxY || z < minZ || z > maxZ) continue;
        const dx = x - c.x, dy = y - c.y, dz = z - c.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r2) continue;
        const t = 1 - d2 / r2;
        const w = t * t * (3 - 2 * t); // smoothstep falloff
        if (brush === 'smooth') {
          const nb = this.neighbors[i / 3];
          if (!nb.length) continue;
          let ax = 0, ay = 0, az = 0;
          for (const j of nb) { ax += src[j * 3]; ay += src[j * 3 + 1]; az += src[j * 3 + 2]; }
          ax /= nb.length; ay /= nb.length; az /= nb.length;
          const k = Math.min(1, w * amount);
          pos[i] += (ax - x) * k; pos[i + 1] += (ay - y) * k; pos[i + 2] += (az - z) * k;
          continue;
        }
        // ease off as the vertex approaches its travel limit (no hard cliffs, no runaway)
        const ox = x - base[i], oy = y - base[i + 1], oz = z - base[i + 2];
        const soft = Math.max(0, 1 - Math.sqrt(ox * ox + oy * oy + oz * oz) / MAX_OFFSET) ** 2;
        const s = amount * w * soft;
        if (brush === 'inflate') {
          pos[i] += nor[i] * s; pos[i + 1] += nor[i + 1] * s; pos[i + 2] += nor[i + 2] * s;
        } else {
          const sign = brush === 'push' ? -1 : 1;
          pos[i] += dir.x * s * sign; pos[i + 1] += dir.y * s * sign; pos[i + 2] += dir.z * s * sign;
        }
      }
    }
    this._commit();
  }

  // ---- serialization (offsets from the base shape, quantized to Int16) ----
  serialize() {
    const pos = this.positions.array, base = this.basePositions;
    const q = new Int16Array(pos.length);
    for (let i = 0; i < pos.length; i++) q[i] = Math.round(THREE.MathUtils.clamp((pos[i] - base[i]) * Q, -32767, 32767));
    const out = { color: this.getColor(), base: { ...this.base }, offsets16: bytesToBase64(new Uint8Array(q.buffer)) };
    if (this.painted.some((v) => v)) {
      out.paint = bytesToBase64(this.paint);       // RGB bytes per vertex
      out.painted = bytesToBase64(this.painted);   // mask
    }
    return out;
  }
  deserialize(data) {
    if (data.base) this.setBase(data.base);
    this.undoStack.length = 0; this.redoStack.length = 0;
    this.painted.fill(0);
    if (data.color) this.baseColor.set(data.color);
    this._fillPaint(this.baseColor, true);
    const arr = Float32Array.from(this.basePositions);
    if (data.offsets16) {
      const q = new Int16Array(base64ToBytes(data.offsets16).buffer);
      if (q.length === arr.length) for (let i = 0; i < arr.length; i++) arr[i] += q[i] / Q;
      else console.warn('clay: vertex count mismatch, keeping base shape');
    }
    if (data.paint && data.painted) {
      const p = base64ToBytes(data.paint), m = base64ToBytes(data.painted);
      if (p.length === this.paint.length && m.length === this.painted.length) { this.paint.set(p); this.painted.set(m); }
    }
    this._apply({ pos: arr });
  }
}

function averageEdgeLength(geometry) {
  const idx = geometry.index.array, p = geometry.attributes.position.array;
  let sum = 0, n = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3;
    sum += Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2]); n++;
  }
  return sum / n;
}

function buildAdjacency(geometry) {
  const idx = geometry.index.array;
  const count = geometry.attributes.position.count;
  const sets = Array.from({ length: count }, () => new Set());
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    sets[a].add(b).add(c); sets[b].add(a).add(c); sets[c].add(a).add(b);
  }
  return sets.map((s) => Array.from(s));
}

export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBytes(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
