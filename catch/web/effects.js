import * as THREE from 'three';
import { MOUNT, WORLD, MASTS } from './dims.js';
import { patchPlan, PLAN_ASPECTS, FLY_TOP, cordPath } from './thread.js';
import { cameraPose, setOf, STATIONS } from './story.js';
import { finaleSightlines } from './finale.js';

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function flameGeometry() {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(Math.max(0.001, (1 + 0.1 * Math.sin(Math.min(1, t / 0.3) * Math.PI / 2)) * Math.pow(1 - t, 0.75) * (t < 0.3 ? 1 : 1)), -t)); }
  return new THREE.LatheGeometry(pts, 28);
}
const FLAME_GEO = flameGeometry();

export function makeFlame(tex, o = {}) {
  const g = new THREE.Group();
  const layers = [['#ff8a6a', 1, 1, 0.7], ['#ffb85a', 0.8, 0.78, 0.85], ['#fff2cc', 0.52, 0.5, 1]];
  for (const [color, rs, ls, op] of layers) {
    const m = new THREE.Mesh(FLAME_GEO, new THREE.MeshBasicMaterial({ map: tex.tissue || null, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.userData = { rs, ls }; m.renderOrder = 5; g.add(m);
  }
  const light = new THREE.PointLight(o.light || '#ffb470', 0, 0, 1.6);
  light.position.y = -6; g.add(light);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow || null, color: '#ffbf7a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85, fog: false }));
  halo.renderOrder = 6; g.add(halo);
  g.userData = { light, halo, power: o.power ?? 9000, ref: o.ref ?? 3.7 };
  g.visible = false;
  return g;
}

export function setFlame(f, on, radius, length, step, seed = 0) {
  f.visible = on && length > 0.5;
  if (!f.visible) { f.userData.light.intensity = 0; return; }
  const k = 1 + (hash(step * 7.3 + seed) - 0.5) * 0.16, kr = 1 + (hash(step * 3.1 + seed * 2) - 0.5) * 0.08;
  for (const m of f.children) if (m.isMesh) {
    m.scale.set(radius * m.userData.rs * kr, length * m.userData.ls * k, radius * m.userData.rs * kr);
    if (m.material.map) { m.material.map.offset.x = hash(step + seed * 5); }
  }
  f.userData.light.intensity = f.userData.power * Math.min(1, (radius / f.userData.ref) ** 2) * (0.95 + 0.1 * hash(step * 1.7 + seed));
  f.userData.light.position.y = -Math.min(length * 0.4, 14);
  const hs = radius * (4.2 + 0.6 * hash(step * 2.3 + seed));
  f.userData.halo.scale.set(hs, hs, 1); f.userData.halo.position.y = -radius * 0.9;
}

export function makeSmoke(tex) {
  const g = new THREE.Group(), puffs = [], low = PLAN_ASPECTS.flatMap((k) => patchPlan(k)).filter((p) => p.set === 'A' && p.win[0] < 2.6 && p.win[1] > 1.5 && Math.hypot(p.centre.x, p.centre.z) < 340 && p.centre.y - p.radius < 95).map((p) => { const d = Math.hypot(p.centre.x, p.centre.z); return [Math.atan2(p.centre.z, p.centre.x), Math.atan((p.radius + 38) / d)]; });
  for (let i = 0; i < 46; i++) {
    let a = hash(i + 1) * Math.PI * 2;
    if (Math.cos(a) < -0.55) a += Math.PI * 0.6;
    for (const [x, z] of MASTS.at) { const m = Math.atan2(z, x), d = Math.atan2(Math.sin(a - m), Math.cos(a - m)); if (Math.abs(d) < 0.5) a = m + (d < 0 ? -1 : 1) * (0.5 + Math.abs(d) * 0.6); }
    for (const [m, w] of low) { const d = Math.atan2(Math.sin(a - m), Math.cos(a - m)); if (Math.abs(d) < w) a = m + (d < 0 ? -1 : 1) * (w + Math.abs(d) * 0.3); }
    const m = new THREE.SpriteMaterial({ map: (i % 3 === 0 ? tex.cotton2 : null) || tex.cotton || null, color: '#f4ede4', transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(m); s.renderOrder = 4; g.add(s);
    puffs.push({ s, a, t0: hash(i + 9) * 9, r0: 5 + hash(i + 3) * 5, v: 2.2 + hash(i + 5) * 2.8, grow: 1.4 + hash(i + 7) * 1.4 });
  }
  g.userData.puffs = puffs;
  return g;
}

export const SMOKE_START = MOUNT.legR + MOUNT.leg + 1.5;
export function smokeState(p, T) {
  const t = T - p.t0;
  if (t <= 0) return null;
  const r = p.r0 + p.grow * Math.sqrt(t) * 2.2, d = SMOKE_START + r * 0.8 + p.v * Math.pow(t, 0.62) * 3;
  const fadeIn = Math.min(1, t / 2.5), fadeOut = Math.max(0, 1 - Math.max(0, T - 40) / 45);
  return { x: Math.cos(p.a) * d, y: r * 0.8, z: Math.sin(p.a) * d, r, opacity: 0.92 * fadeIn * fadeOut };
}
export function setSmoke(g, T, tint) {
  for (const p of g.userData.puffs) {
    const st = smokeState(p, T);
    p.s.visible = !!st && st.opacity > 0.01;
    if (!p.s.visible) continue;
    p.s.position.set(st.x, st.y, st.z); p.s.scale.set(st.r * 2.5, st.r * 2.5, 1);
    p.s.material.opacity = st.opacity;
    p.s.material.color.copy(tint);
  }
}

export const CLOUDS = (() => {
  const out = [];
  for (let i = 0; i < 34; i++) {
    const side = i % 2 ? 1 : -1, x = -260 + hash(i + 40) * 560, y = 150 + hash(i + 41) * 95, z = side * (55 + hash(i + 42) * 260), r = 22 + hash(i + 43) * 30;
    out.push({ x, y, z, r });
  }
  for (let i = 0; i < 18; i++) out.push({ x: -600 + hash(i + 70) * 1700, y: 120 + hash(i + 71) * 160, z: -420 - hash(i + 72) * 300, r: 45 + hash(i + 73) * 50 });
  const pts = [];
  for (const aspect of PLAN_ASPECTS) {
    const plan = patchPlan(aspect).filter((p) => p.set === 'A');
    for (const p of plan) for (let y = p.centre.y - p.radius; y < FLY_TOP; y += 6) pts.push([p.centre.x, y, p.centre.z, p.radius]);
    for (const k of ['booster', 'ship', 'tower']) {
      const list = plan.filter((p) => p.region === k);
      for (let i = 1; i < list.length; i++) { const a = list[i - 1], b = list[i]; if (b.reprise || b.alone) continue; for (const q of cordPath(a, b, 60).pts) pts.push([q.x, q.y, q.z, 1]); }
    }
  }
  const cams = [];
  for (let s = 0; s <= STATIONS.length - 1 + 0.4; s += 0.02) { if (setOf(s) !== 'A') continue; for (const aspect of [2.4, 1.6, 1.2, 1, 0.75, 390 / 844, 0.4]) cams.push(cameraPose(s, aspect).position); }
  const sight = finaleSightlines(), clear = (c) => sight.every(([a, b]) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, ab.dot({ x: c.x - a.x, y: c.y - a.y, z: c.z - a.z }) / ab.lengthSq())), q = a.clone().addScaledVector(ab, t); return Math.hypot(c.x - q.x, c.y - q.y, c.z - q.z) > c.r * 1.25 + 8; });
  return out.filter((c) => pts.every(([x, y, z, r]) => Math.hypot(c.x - x, c.y - y, c.z - z) > c.r * 0.8 + r + 3) && cams.every((p) => Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) > c.r * 1.6 + 40) && clear(c));
})();
export function makeClouds(tex) {
  const g = new THREE.Group();
  for (const c of CLOUDS) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.cotton2 || tex.cotton || null, color: '#fbe9e4', transparent: true, depthWrite: false, opacity: 0.95, fog: true }));
    s.position.set(c.x, c.y, c.z); s.scale.set(c.r * 2.4, c.r * 1.7, 1); s.renderOrder = 3; g.add(s);
  }
  return g;
}

export function makeStars(tex, count = 2100) {
  const pos = [], size = [];
  for (let i = 0; i < count; i++) {
    const x = -3500 + hash(i + 200) * 7800, y = 1150 + Math.pow(hash(i + 201), 0.7) * 1600;
    pos.push(x, y, WORLD.backdropZ + 2); size.push(0.6 + hash(i + 202) * 1.6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: tex.glow || null, color: '#fff3dc', size: 7, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const p = new THREE.Points(geo, mat); p.renderOrder = 1;
  return p;
}

export function makeGlow(tex, color = '#ffb36b') {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow || null, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  s.renderOrder = 6;
  return s;
}

export function makePlasma(tex) {
  const g = new THREE.Group(), mats = [];
  for (const [r, op, color] of [[5.3, 0.55, '#ff7f8c'], [6.2, 0.35, '#e45fa6'], [7.4, 0.2, '#ff9f86']]) {
    const geo = new THREE.CylinderGeometry(r, r, 46, 48, 1, true, Math.PI * 0.62, Math.PI * 0.76);
    geo.translate(0, 25, 0);
    const m = new THREE.MeshBasicMaterial({ map: tex.tissue || null, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = 5; g.add(mesh); mats.push([m, op]);
  }
  const light = new THREE.PointLight('#ff8a92', 0, 0, 1.4); light.position.set(0, 25, -12); g.add(light);
  g.userData = { mats, light };
  g.visible = false;
  return g;
}
export function setPlasma(p, k, step) {
  p.visible = k > 0.01;
  if (!p.visible) { p.userData.light.intensity = 0; return; }
  for (const [m, op] of p.userData.mats) { m.opacity = op * k * (0.85 + 0.3 * hash(step * 1.3)); if (m.map) m.map.offset.x = hash(step * 0.7); }
  p.userData.light.intensity = 9000 * k;
}

export const VENTS = [[0.15, 62, 0.4], [-0.6, 40, 1.3], [2.4, 74, 2.1], [3.1, 30, 0.8], [1.2, 104, 1.7], [-2.6, 120, 0.2]];
export function makeVents(tex) {
  const g = new THREE.Group(), puffs = [];
  VENTS.forEach(([a, y, ph], i) => {
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.cotton || null, color: '#f6f2ee', transparent: true, depthWrite: false, opacity: 0 }));
      s.renderOrder = 4; g.add(s); puffs.push({ s, a, y, ph: ph + k * 0.33, i });
    }
  });
  g.userData.puffs = puffs;
  return g;
}
export function ventState(p, now, R0) {
  const t = ((now / 2600 + p.ph) % 1), r = 1.2 + t * 3.6, out = R0 + r * 0.8 + 0.3 + t * 3.5;
  return { x: Math.cos(p.a) * out, y: p.y - t * t * 7, z: Math.sin(p.a) * out, r, opacity: Math.sin(t * Math.PI) * 0.55 };
}
