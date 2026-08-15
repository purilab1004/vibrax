// Facial part catalog. Each builder returns a THREE.Group lying in the XY plane, facing +Z,
// sized for a 2-unit-wide clay head. Named children (e.g. "pupil", "lip") are hooks for animation later.
import * as THREE from 'three';

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });

const WHITE = '#fffaf2';

function arc(radius, tube, start, length, color, segments = 24) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, segments, length), mat(color));
  m.rotation.z = start;
  return m;
}
function sphere(r, color, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat(color));
  m.scale.set(sx, sy, sz);
  return m;
}
function box(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
}
function capsule(r, len, color) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat(color));
}
function group(...children) {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

// SVG icons for the palette (48x48 viewBox, currentColor)
const I = {
  dot: `<circle cx="24" cy="24" r="8" fill="currentColor"/>`,
  round: `<circle cx="24" cy="24" r="12" fill="#fff" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="24" r="6" fill="currentColor"/>`,
  happy: `<path d="M12 28 Q24 12 36 28" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,
  closed: `<path d="M12 22 Q24 32 36 22" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,
  sleepy: `<line x1="12" y1="24" x2="36" y2="24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,
  sparkle: `<circle cx="24" cy="24" r="12" fill="currentColor"/><circle cx="19" cy="19" r="4" fill="#fff"/><circle cx="29" cy="28" r="2" fill="#fff"/>`,
  browFlat: `<rect x="10" y="20" width="28" height="7" rx="3.5" fill="currentColor"/>`,
  browArch: `<path d="M10 30 Q24 12 38 30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  browAngry: `<path d="M10 18 L38 30" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`,
  browSad: `<path d="M10 30 L38 18" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`,
  browThick: `<rect x="8" y="17" width="32" height="12" rx="6" fill="currentColor"/>`,
  smile: `<path d="M12 20 Q24 36 36 20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,
  line: `<line x1="14" y1="24" x2="34" y2="24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,
  open: `<ellipse cx="24" cy="25" rx="9" ry="11" fill="currentColor"/>`,
  grin: `<path d="M10 20 Q24 40 38 20 Z" fill="currentColor"/><rect x="14" y="21" width="20" height="5" fill="#fff"/>`,
  oh: `<circle cx="24" cy="24" r="8" fill="none" stroke="currentColor" stroke-width="5"/>`,
  frown: `<path d="M12 30 Q24 16 36 30" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,
  cat: `<path d="M10 22 Q17 32 24 22 Q31 32 38 22" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`,
  noseDot: `<circle cx="24" cy="24" r="6" fill="currentColor"/>`,
  noseTri: `<path d="M24 14 L32 32 L16 32 Z" fill="currentColor"/>`,
  noseButton: `<ellipse cx="24" cy="24" rx="9" ry="6" fill="currentColor"/>`,
  blush: `<ellipse cx="24" cy="24" rx="12" ry="7" fill="currentColor" opacity=".6"/>`,
  freckle: `<circle cx="16" cy="22" r="3" fill="currentColor"/><circle cx="26" cy="19" r="3" fill="currentColor"/><circle cx="31" cy="27" r="3" fill="currentColor"/><circle cx="20" cy="30" r="3" fill="currentColor"/>`,
  star: `<path d="M24 8 L28 20 L40 20 L30 27 L34 39 L24 32 L14 39 L18 27 L8 20 L20 20 Z" fill="currentColor"/>`,
};

/** @type {Record<string, {label:string, mirror:boolean, defaultColor:string, styles:Record<string,{label:string, icon:string, build:(color:string)=>THREE.Group}>}>} */
export const PART_TYPES = {
  eye: {
    label: '눈', mirror: true, defaultColor: '#2b2b2b',
    styles: {
      dot: { label: '점', icon: I.dot, build: (c) => group(sphere(0.09, c, 1, 1, 0.6)) },
      round: {
        label: '동그란', icon: I.round,
        build: (c) => {
          const white = sphere(0.14, WHITE, 1, 1, 0.45); white.name = 'sclera';
          const pupil = sphere(0.075, c, 1, 1, 0.6); pupil.position.set(0.02, 0, 0.055); pupil.name = 'pupil';
          return group(white, pupil);
        },
      },
      happy: { label: '웃는', icon: I.happy, build: (c) => group(arc(0.11, 0.028, Math.PI * 0.15, Math.PI * 0.7, c)) },
      closed: { label: '감은', icon: I.closed, build: (c) => group(arc(0.11, 0.028, Math.PI * 1.15, Math.PI * 0.7, c)) },
      sleepy: { label: '졸린', icon: I.sleepy, build: (c) => { const m = capsule(0.028, 0.18, c); m.rotation.z = Math.PI / 2; return group(m); } },
      sparkle: {
        label: '반짝', icon: I.sparkle,
        build: (c) => {
          const eye = sphere(0.13, c, 1, 1, 0.55); eye.name = 'pupil';
          const h1 = sphere(0.045, WHITE); h1.position.set(-0.05, 0.05, 0.075);
          const h2 = sphere(0.022, WHITE); h2.position.set(0.05, -0.04, 0.075);
          return group(eye, h1, h2);
        },
      },
    },
  },
  brow: {
    label: '눈썹', mirror: true, defaultColor: '#3a2a22',
    styles: {
      flat: { label: '일자', icon: I.browFlat, build: (c) => { const m = capsule(0.03, 0.22, c); m.rotation.z = Math.PI / 2; return group(m); } },
      arch: { label: '아치', icon: I.browArch, build: (c) => group(arc(0.14, 0.03, Math.PI * 0.2, Math.PI * 0.6, c)) },
      angry: { label: '화난', icon: I.browAngry, build: (c) => { const m = capsule(0.032, 0.22, c); m.rotation.z = Math.PI / 2 - 0.4; return group(m); } },
      sad: { label: '슬픈', icon: I.browSad, build: (c) => { const m = capsule(0.032, 0.22, c); m.rotation.z = Math.PI / 2 + 0.4; return group(m); } },
      thick: { label: '두꺼운', icon: I.browThick, build: (c) => { const m = capsule(0.055, 0.2, c); m.rotation.z = Math.PI / 2; return group(m); } },
    },
  },
  mouth: {
    label: '입', mirror: false, single: true, defaultColor: '#b8434a', // single: only one per character
    styles: {
      smile: { label: '미소', icon: I.smile, build: (c) => group(arc(0.16, 0.03, Math.PI * 1.15, Math.PI * 0.7, c)) },
      line: { label: '일자', icon: I.line, build: (c) => { const m = capsule(0.03, 0.22, c); m.rotation.z = Math.PI / 2; return group(m); } },
      open: {
        label: '벌린', icon: I.open,
        build: (c) => {
          const inner = sphere(0.12, '#4a1a1e', 0.9, 1.1, 0.4); inner.name = 'cavity';
          const lip = arc(0.12, 0.03, 0, Math.PI * 2, c); lip.scale.set(0.9, 1.1, 1); lip.name = 'lip';
          return group(inner, lip);
        },
      },
      grin: {
        label: '활짝', icon: I.grin,
        build: (c) => {
          const g = new THREE.Group();
          const shape = new THREE.Shape();
          shape.moveTo(-0.2, 0.02); shape.quadraticCurveTo(0, -0.28, 0.2, 0.02); shape.lineTo(-0.2, 0.02);
          const mouth = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }), mat(c));
          mouth.name = 'lip';
          const teeth = box(0.24, 0.05, 0.05, WHITE); teeth.position.set(0, -0.02, 0.02); teeth.name = 'teeth';
          g.add(mouth, teeth);
          return g;
        },
      },
      oh: { label: '오', icon: I.oh, build: (c) => { const m = arc(0.07, 0.03, 0, Math.PI * 2, c); m.name = 'lip'; return group(m); } },
      frown: { label: '시무룩', icon: I.frown, build: (c) => group(arc(0.16, 0.03, Math.PI * 0.15, Math.PI * 0.7, c)) },
      cat: {
        label: '고양이', icon: I.cat,
        build: (c) => {
          const a = arc(0.08, 0.025, Math.PI * 1.1, Math.PI * 0.8, c); a.position.x = -0.08;
          const b = arc(0.08, 0.025, Math.PI * 1.1, Math.PI * 0.8, c); b.position.x = 0.08;
          return group(a, b);
        },
      },
    },
  },
  nose: {
    label: '코', mirror: false, defaultColor: '#d49478',
    styles: {
      dot: { label: '점', icon: I.noseDot, build: (c) => group(sphere(0.07, c, 1, 1, 0.8)) },
      tri: {
        label: '세모', icon: I.noseTri,
        build: (c) => {
          const shape = new THREE.Shape();
          shape.moveTo(0, 0.09); shape.lineTo(0.08, -0.07); shape.lineTo(-0.08, -0.07); shape.lineTo(0, 0.09);
          const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }), mat(c));
          return group(m);
        },
      },
      button: { label: '단추', icon: I.noseButton, build: (c) => group(sphere(0.1, c, 1.2, 0.8, 0.8)) },
    },
  },
  extra: {
    label: '기타', mirror: true, defaultColor: '#f0908a',
    styles: {
      blush: { label: '볼터치', icon: I.blush, build: (c) => group(sphere(0.13, c, 1.3, 0.8, 0.25)) },
      freckle: {
        label: '주근깨', icon: I.freckle,
        build: (c) => group(...[[-0.08, 0.02], [0.02, 0.06], [0.08, -0.03], [-0.02, -0.06]].map(([x, y]) => { const s = sphere(0.02, c); s.position.set(x, y, 0); return s; })),
      },
      star: {
        label: '별', icon: I.star,
        build: (c) => {
          const shape = new THREE.Shape();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 0.05 : 0.11, a = Math.PI / 2 + (i * Math.PI) / 5;
            i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }), mat(c));
          return group(m);
        },
      },
    },
  },
};

export function buildPart(type, style, color) {
  const def = PART_TYPES[type]?.styles[style];
  if (!def) throw new Error(`unknown part ${type}/${style}`);
  const g = def.build(color);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

export function iconSvg(inner) {
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
