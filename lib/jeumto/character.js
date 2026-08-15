// Character = clay + attached parts. Parts are anchored to a clay face (index + barycentric),
// so they ride along when the clay is sculpted. Serializes to a rig-friendly JSON.
import * as THREE from 'three';
import { buildPart, PART_TYPES } from './parts.js';

export const FORMAT_VERSION = 1;
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4();

let nextId = 1;

export class Character {
  constructor(clay) {
    this.clay = clay;
    this.name = '내 점토';
    this.root = new THREE.Group();
    this.root.name = 'character';
    this.partsGroup = new THREE.Group();
    this.partsGroup.name = 'parts';
    this.root.add(clay.mesh, this.partsGroup);
    /** @type {Map<number, PartInstance>} */
    this.parts = new Map();
    clay.onChange = () => this.reseatAll();
  }

  /** Compute anchor (face + barycentric) from a raycast intersection on the clay mesh. */
  anchorFromHit(hit) {
    const { a, b, c } = hit.face;
    const pos = this.clay.positions;
    _a.fromBufferAttribute(pos, a); _b.fromBufferAttribute(pos, b); _c.fromBufferAttribute(pos, c);
    const local = this.clay.mesh.worldToLocal(hit.point.clone());
    const bary = new THREE.Vector3();
    THREE.Triangle.getBarycoord(local, _a, _b, _c, bary);
    return { face: [a, b, c], bary: [bary.x, bary.y, bary.z] };
  }

  /** Evaluate anchor → local position + smooth normal on the current clay surface. */
  evalAnchor(anchor, outPos, outNor) {
    const [a, b, c] = anchor.face, [u, v, w] = anchor.bary;
    const pos = this.clay.positions, nor = this.clay.normals;
    _a.fromBufferAttribute(pos, a); _b.fromBufferAttribute(pos, b); _c.fromBufferAttribute(pos, c);
    outPos.set(0, 0, 0).addScaledVector(_a, u).addScaledVector(_b, v).addScaledVector(_c, w);
    _a.fromBufferAttribute(nor, a); _b.fromBufferAttribute(nor, b); _c.fromBufferAttribute(nor, c);
    outNor.set(0, 0, 0).addScaledVector(_a, u).addScaledVector(_b, v).addScaledVector(_c, w).normalize();
  }

  addPart({ type, style, color, scale = 1, rotation = 0, anchor, mirrorOf = null, id = null }) {
    const part = new PartInstance({ id: id ?? nextId++, type, style, color, scale, rotation, anchor, mirrorOf });
    if (part.id >= nextId) nextId = part.id + 1;
    this.parts.set(part.id, part);
    this.partsGroup.add(part.object);
    this.seat(part);
    this.relabel();
    return part;
  }

  removePart(id, { withPartner = true } = {}) {
    const part = this.parts.get(id);
    if (!part) return;
    this.partsGroup.remove(part.object);
    part.dispose();
    this.parts.delete(id);
    if (withPartner) {
      for (const p of this.parts.values()) if (p.mirrorOf === id) this.removePart(p.id, { withPartner: false });
      if (part.mirrorOf != null) this.removePart(part.mirrorOf, { withPartner: false });
    }
    this.relabel();
  }

  clearParts() { for (const id of [...this.parts.keys()]) this.removePart(id, { withPartner: false }); }

  seat(part) {
    this.evalAnchor(part.anchor, _p, _n);
    const o = part.object;
    o.position.copy(_p).addScaledVector(_n, 0.005 * part.scale); // sit just above the surface
    _m.lookAt(_p.clone().add(_n), _p, UP);
    o.quaternion.setFromRotationMatrix(_m);
    if (part.rotation) o.rotateZ(THREE.MathUtils.degToRad(part.rotation)); // roll around the surface normal
    o.scale.setScalar(part.scale);
    o.updateWorldMatrix(true, true); // make it hit-testable immediately, before the next render
  }
  reseatAll() { for (const p of this.parts.values()) this.seat(p); }

  /** Rebuild a part's meshes (after style/color change) keeping its anchor. */
  restyle(part, { style = part.style, color = part.color, scale = part.scale, rotation = part.rotation }) {
    part.style = style; part.color = color; part.scale = scale; part.rotation = rotation;
    part.rebuild();
    this.seat(part);
  }

  /** Give parts semantic names (eye_L, eye_R, mouth, ...) for later rigging. */
  relabel() {
    const counts = {};
    for (const p of [...this.parts.values()].sort((x, y) => x.id - y.id)) {
      const t = p.type;
      let name;
      if (PART_TYPES[t].mirror) {
        this.evalAnchor(p.anchor, _p, _n);
        const side = _p.x < -0.02 ? 'R' : _p.x > 0.02 ? 'L' : 'C'; // viewer's right = character's left
        counts[t + side] = (counts[t + side] || 0) + 1;
        name = `${t}_${side}${counts[t + side] > 1 ? counts[t + side] : ''}`;
      } else {
        counts[t] = (counts[t] || 0) + 1;
        name = counts[t] > 1 ? `${t}${counts[t]}` : t;
      }
      p.object.name = name;
    }
  }

  /** Called after the clay was turned to face a new front: mirror pairs only stay valid for 180°. */
  afterClayTurn(quarterTurns) {
    if (((quarterTurns % 4) + 4) % 4 !== 2) for (const p of this.parts.values()) p.mirrorOf = null;
    this.reseatAll();
    this.relabel();
  }

  findPartByObject(obj) {
    let o = obj;
    while (o && o.parent !== this.partsGroup) o = o.parent;
    if (!o) return null;
    for (const p of this.parts.values()) if (p.object === o) return p;
    return null;
  }

  // ---- serialization ----
  serialize() {
    return {
      format: 'jeumto-character',
      version: FORMAT_VERSION,
      name: this.name,
      createdAt: new Date().toISOString(),
      clay: this.clay.serialize(),
      parts: [...this.parts.values()].map((p) => ({
        id: p.id, name: p.object.name, type: p.type, style: p.style, color: p.color,
        scale: p.scale, rotation: p.rotation, anchor: p.anchor, mirrorOf: p.mirrorOf,
      })),
      // reserved for later stages: voice binding, animation clips, expressions
      rig: { mouth: 'mouth', eyes: ['eye_L', 'eye_R'], brows: ['brow_L', 'brow_R'] },
    };
  }

  load(data) {
    if (data?.format !== 'jeumto-character') throw new Error('점토 캐릭터 파일이 아닙니다');
    this.name = data.name || this.name;
    this.clearParts();
    this.clay.deserialize(data.clay || {});
    for (const p of data.parts || []) {
      if (!PART_TYPES[p.type]?.styles[p.style]) continue;
      this.addPart(p);
    }
  }
}

export class PartInstance {
  constructor({ id, type, style, color, scale, rotation = 0, anchor, mirrorOf }) {
    this.id = id; this.type = type; this.style = style; this.color = color;
    this.scale = scale; this.rotation = rotation; this.anchor = anchor; this.mirrorOf = mirrorOf;
    this.object = new THREE.Group();
    this.object.userData.partId = id;
    this.rebuild();
  }
  rebuild() {
    this.dispose();
    this.inner = buildPart(this.type, this.style, this.color);
    // invisible click target so thin parts (arcs, lines) are easy to select
    // (measured before parenting, so the box is in the part's local frame)
    const box = new THREE.Box3().setFromObject(this.inner);
    this.object.add(this.inner);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.hitProxy = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.06, sphere.radius * 0.7), 12, 8),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    this.hitProxy.position.copy(sphere.center);
    this.hitProxy.name = 'hit';
    this.object.add(this.hitProxy);
  }
  dispose() {
    if (!this.inner) return;
    this.inner.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.object.remove(this.inner);
    this.inner = null;
    if (this.hitProxy) { this.hitProxy.geometry.dispose(); this.hitProxy.material.dispose(); this.object.remove(this.hitProxy); this.hitProxy = null; }
  }
  setHighlight(on) {
    this.inner.traverse((o) => { if (o.isMesh) o.material.emissive.set(on ? '#ff8a50' : '#000000'); });
  }
}
