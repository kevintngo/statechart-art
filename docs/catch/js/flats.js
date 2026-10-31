import * as THREE from 'three';
import { SHIP_SET } from './flight.js';

export const FLATS = [
  { tex: 'dunes3', x0: -1100, x1: 300, z: -760, bottom: 0, height: 150, tint: '#c9bcd6' },
  { tex: 'dunes2', x0: -1000, x1: 310, z: -560, bottom: 0, height: 140, tint: '#e2d3cf' },
  { tex: 'dunes1', x0: -900, x1: 320, z: -360, bottom: 0, height: 120, tint: '#ffffff' },
  { tex: 'clouddeck', x0: -700, x1: 500, z: -300, bottom: 120, height: 150, tint: '#ffffff', fog: true },
  { tex: 'clouddeck', x0: -300, x1: 800, z: -520, bottom: 150, height: 170, tint: '#f1e6f2', fog: true, flip: true },
  { tex: 'seawaves', x0: SHIP_SET[0] - 1400, x1: SHIP_SET[0] + 1700, z: -760, bottom: -6, height: 40, tint: '#8fa6c0', set: 'C' },
  { tex: 'seawaves', x0: SHIP_SET[0] - 1200, x1: SHIP_SET[0] + 1500, z: -520, bottom: -6, height: 34, tint: '#a4b8cf', set: 'C', flip: true },
  { tex: 'seawaves', x0: SHIP_SET[0] - 1000, x1: SHIP_SET[0] + 1300, z: -300, bottom: -5, height: 28, tint: '#b8c9da', set: 'C' },
  { tex: 'seawaves', x0: SHIP_SET[0] - 900, x1: SHIP_SET[0] + 1100, z: -140, bottom: -4, height: 20, tint: '#c8d6e2', set: 'C', flip: true },
  { tex: 'seawaves', x0: SHIP_SET[0] - 900, x1: SHIP_SET[0] + 1100, z: 150, bottom: -4, height: 16, tint: '#d4e0ea', set: 'C' },
];

const hash = (n) => { const x = Math.sin(n * 91.7 + 13.3) * 43758.5453; return x - Math.floor(x); };
function endCut() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 64);
  for (let x = 0; x <= 1024; x += 4) { const u = x / 1024, e = Math.min(1, u / 0.06, (1 - u) / 0.06); g.lineTo(x, 64 * (1 - Math.min(1, e * (0.92 + 0.08 * hash(x))))); }
  g.lineTo(1024, 64); g.closePath(); g.fill();
  return new THREE.CanvasTexture(c);
}

export function makeFlats(tex = {}) {
  const g = new THREE.Group(); g.name = 'flats';
  for (const f of FLATS) {
    const t = tex[f.tex]; if (!t) continue;
    const map = t.clone(); map.wrapS = THREE.RepeatWrapping; map.repeat.set(Math.max(1, Math.round((f.x1 - f.x0) / (f.height * 6))) * (f.flip ? -1 : 1), 1); map.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(f.x1 - f.x0, f.height), new THREE.MeshStandardMaterial({ map, alphaMap: f.tex.startsWith('dunes') ? endCut() : null, color: new THREE.Color(f.tint), transparent: true, alphaTest: 0.4, roughness: 1, side: THREE.DoubleSide, fog: f.fog !== false }));
    m.position.set((f.x0 + f.x1) / 2, f.bottom + f.height / 2, f.z); m.userData.flat = f; m.renderOrder = 1;
    g.add(m);
  }
  return g;
}
