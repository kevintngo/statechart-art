import * as THREE from 'three';
import { chartSlot, edgeKind, flown } from './chartdata.js';

export const FIN = { cx: 88, cy: 282, z: -70, k: 0.2, slot: 30, row: 26, radius: 9.5, lift: 0.69, bead: 1.3, start: 11.8, stitch: [12.0, 12.36] };
const FACING = new THREE.Vector3(Math.sin(-0.3), 0, Math.cos(-0.3));
const UP = new THREE.Vector3(0, 1, 0);
export const RIGHT = UP.clone().cross(FACING).normalize();
export const FINALE_VIEW = { target: new THREE.Vector3(FIN.cx, FIN.cy - 4, FIN.z).addScaledVector(RIGHT, -32), dist: 480, yaw: -0.3, pitch: 0.04, span: [170, 140] };
FINALE_VIEW.camera = FINALE_VIEW.target.clone().add(new THREE.Vector3(Math.sin(-0.3) * Math.cos(0.04), Math.sin(0.04), Math.cos(-0.3) * Math.cos(0.04)).multiplyScalar(FINALE_VIEW.dist * 1.6));
export function finaleSightlines() {
  const out = [], c = new THREE.Vector3(FIN.cx, FIN.cy, FIN.z), [hw, hh] = FINALE_VIEW.span;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 6; j++) out.push([FINALE_VIEW.camera, c.clone().addScaledVector(RIGHT, -hw + (2 * hw * i) / 8).addScaledVector(UP, -hh + (2 * hh * j) / 6)]);
  return out;
}

const THREAD = { gold: ['#f2dfae', '#e2b33f'], red: ['#ef9a8c', '#c4453a'], cream: ['#efe6d2', '#bfb39d'] };

function placer(chart, layout) {
  const centre = new THREE.Vector3(FIN.cx, FIN.cy, FIN.z);
  if (layout && chart && Object.keys(chart.states).every((id) => layout.nodes[id])) {
    const ns = Object.values(layout.nodes), xs = ns.map((n) => n.cx), ys = ns.map((n) => n.cy);
    const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
    const at = ([px, py], lift = 0) => centre.clone().addScaledVector(RIGHT, (px - mx) * FIN.k).addScaledVector(UP, -(py - my) * FIN.k).addScaledVector(FACING, lift);
    return { at, node: (id) => at([layout.nodes[id].cx, layout.nodes[id].cy]), layout, tags: (layout.clusters || []).filter((c) => /^r\d+$/.test(c.id)).map((c) => ({ id: c.id, centre: at([c.x + c.w / 2, c.y + 18]) })) };
  }
  const at = ([sx, row], lift = 0) => centre.clone().addScaledVector(RIGHT, (sx - 1.9) * FIN.slot).addScaledVector(UP, -(row - 3.8) * FIN.row).addScaledVector(FACING, lift);
  return { at, node: (id) => at(chartSlot(chart.states[id].label)), layout: null, tags: [] };
}

function trim(pts, c, r, fromStart) {
  const list = fromStart ? pts : [...pts].reverse(), flat = (p) => { const d = p.clone().sub(c); return d.addScaledVector(FACING, -d.dot(FACING)).length(); };
  let i = 0;
  while (i < list.length - 2 && flat(list[i + 1]) < r) i++;
  const a = list[i], b = list[i + 1];
  let lo = 0, hi = 1;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (flat(a.clone().lerp(b, m)) < r) lo = m; else hi = m; }
  const out = [a.clone().lerp(b, lo), ...list.slice(i + 1)];
  return fromStart ? out : out.reverse();
}

function cordPoints(P, e) {
  const lift = FIN.lift, r = FIN.radius * 0.92;
  let pts = null;
  if (P.layout) {
    const le = P.layout.edges.find((q) => q.from === e.from && q.to === e.to);
    if (le) pts = le.pts.map((p) => P.at(p, lift));
  }
  if (!pts) {
    const a = e.from === '[*]' ? P.node(e.to).add(new THREE.Vector3(0, FIN.radius * 2.4, 0)) : P.node(e.from), b = P.node(e.to);
    pts = [a.addScaledVector(FACING, lift), b.addScaledVector(FACING, lift)];
  }
  if (e.from !== '[*]') pts = trim(pts, P.node(e.from), r, true);
  return trim(pts, P.node(e.to), r, false);
}

export const TAG = { w: 40, h: 8.75 };
function tagTexture(text) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 224;
  const g = c.getContext('2d');
  g.fillStyle = '#f6efe2'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 900; i++) { const x = (Math.sin(i * 12.9898) * 43758.5453) % 1, y = (Math.sin(i * 78.233) * 12345.678) % 1; g.fillStyle = `rgba(120,100,80,${0.04 + Math.abs(x) * 0.05})`; g.fillRect(Math.abs(x) * c.width, Math.abs(y) * c.height, 2, 1); }
  g.strokeStyle = '#6f655a'; g.lineWidth = 6; g.strokeRect(5, 5, c.width - 10, c.height - 10);
  g.fillStyle = '#1d1a1e'; g.font = '700 104px "Kevin Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function patchMaterial(tex, atlas, label, region, dim) {
  const base = { 'The booster': '#26304f', 'The ship': '#3a2f45', 'The tower': '#2f4a43' }[region] || '#26304f';
  const o = { roughness: 1, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false, color: new THREE.Color(dim ? '#9d97a8' : '#ffffff') };
  if (tex.patches && atlas && atlas[label]) {
    const [col, row] = atlas[label], t = tex.patches.clone();
    t.repeat.set(1 / 5, 1 / 5); t.offset.set(col / 5, 1 - (row + 1) / 5); t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ ...o, map: t, alphaTest: 0.35 });
  }
  return new THREE.MeshStandardMaterial({ ...o, color: new THREE.Color(base) });
}

export function makeFinale(tex = {}, atlas = null, chart = null, layout = null) {
  const g = new THREE.Group(); g.name = 'finale';
  if (!chart) { g.userData = { patches: [], cords: [], beads: [], tags: [] }; return g; }
  const P = placer(chart, layout), patches = {}, cords = [], beads = [];
  for (const st of Object.values(chart.states)) {
    const c = P.node(st.id), dim = !flown(st.label) && !st.classes.includes('breaks');
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(FIN.radius, FIN.radius, 0.6, 48), [new THREE.MeshStandardMaterial({ color: '#3b3346', roughness: 1, transparent: true, opacity: 0, fog: false }), patchMaterial(tex, atlas, st.label, st.region, dim), patchMaterial(tex, atlas, st.label, st.region, dim)]);
    disc.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    const holder = new THREE.Group(); holder.add(disc); holder.position.copy(c); holder.lookAt(c.clone().add(FACING));
    g.add(holder);
    patches[st.id] = { st, centre: c, holder, mats: [...disc.material] };
  }
  const tags = [];
  for (const t of P.tags) {
    const name = chart.regions.find((r) => r.id === t.id)?.name || '', mat = new THREE.MeshStandardMaterial({ map: tagTexture(name), color: '#ffffff', roughness: 1, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(TAG.w, TAG.h, 0.2), mat), holder = new THREE.Group();
    holder.add(mesh); holder.position.copy(t.centre); holder.lookAt(t.centre.clone().add(FACING)); g.add(holder);
    tags.push({ id: t.id, centre: t.centre, holder, mats: [mat], top: t.centre.clone().add(new THREE.Vector3(0, TAG.h / 2, 0)) });
  }
  const hangers = [...Object.values(patches).map((p) => ({ p, top: p.centre.clone().add(new THREE.Vector3(0, FIN.radius, 0)), half: FIN.radius * 0.95 })), ...tags.map((t) => ({ p: t, top: t.top, half: TAG.w / 2 }))];
  const along = (v) => v.dot(RIGHT);
  for (const h of hangers) {
    let end = h.top.clone().add(new THREE.Vector3(0, 900, 0));
    for (const q of Object.values(patches)) {
      if (q === h.p || q.centre.y <= h.top.y) continue;
      if (Math.abs(along(q.centre) - along(h.top)) < FIN.radius * 0.95 && q.centre.y - FIN.radius < end.y) end = h.top.clone().setY(q.centre.y - Math.sqrt(Math.max(0, FIN.radius * FIN.radius - (along(q.centre) - along(h.top)) ** 2)));
    }
    for (const t of tags) if (t !== h.p && t.centre.y > h.top.y && Math.abs(along(t.centre) - along(h.top)) < TAG.w / 2 + 0.15 && t.centre.y - TAG.h / 2 < end.y) end = h.top.clone().setY(t.centre.y - TAG.h / 2);
    const len = end.y - h.top.y, line = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, len, 6), new THREE.MeshBasicMaterial({ color: '#d8ccb4', transparent: true, opacity: 0, fog: false }));
    line.position.copy(h.top).add(new THREE.Vector3(0, len / 2, 0)); g.add(line);
    h.p.line = line; h.p.lineEnds = [h.top.clone(), end]; h.p.mats.push(line.material);
  }
  const list = chart.edges.filter((e) => e.from === '[*]' || chart.states[e.from]);
  list.forEach((e, i) => {
    const kind = e.from === '[*]' ? (flown(chart.states[e.to].label) ? 'gold' : 'cream') : edgeKind(chart, e), pts = cordPoints(P, e);
    const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
    const segs = Math.max(16, pts.length * 3), geo = new THREE.TubeGeometry(curve, segs, 0.38, 8, false), [c1, c2] = THREAD[kind] || THREAD.cream;
    const mat = new THREE.MeshStandardMaterial({ color: c1, emissive: new THREE.Color(c2), emissiveIntensity: kind === 'cream' ? 0.12 : 0.55, roughness: 0.8, transparent: true, opacity: 0, fog: false });
    const m = new THREE.Mesh(geo, mat); g.add(m);
    const cord = { e, kind, mesh: m, mat, pts, segs, order: i / Math.max(1, list.length - 1) };
    cords.push(cord);
    if (e.from === '[*]') {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(FIN.bead, 16, 12), new THREE.MeshStandardMaterial({ color: '#2b2422', roughness: 0.6, transparent: true, opacity: 0, fog: false }));
      bead.position.copy(pts[0]); g.add(bead); beads.push({ mesh: bead, mat: bead.material, cord });
    }
  });
  const light = new THREE.SpotLight('#ffe2b8', 0, 1600, 0.36, 0.7, 0.4);
  const mid = new THREE.Vector3(FIN.cx, FIN.cy, FIN.z);
  light.position.copy(mid).addScaledVector(FACING, 700).add(new THREE.Vector3(0, 160, 0)); light.target.position.copy(mid);
  g.add(light, light.target);
  g.userData = { patches: Object.values(patches), cords, beads, tags, light };
  return g;
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export function lightFinale(g, s) {
  const show = smooth((s - FIN.start) / 0.25);
  g.visible = show > 0.001;
  if (!g.visible) return;
  for (const p of [...g.userData.patches, ...g.userData.tags]) for (const m of p.mats) { m.opacity = show; if (m.map && m.alphaTest) m.alphaTest = Math.max(0.01, 0.35 * show); }
  g.userData.light.intensity = show * 6;
  const [a, b] = FIN.stitch;
  for (const c of g.userData.cords) {
    const t0 = a + c.order * (b - a) * 0.75, grow = smooth((s - t0) / ((b - a) * 0.25 + 0.02));
    const idx = c.mesh.geometry.index.count, seg = Math.floor(grow * c.segs);
    c.mesh.geometry.setDrawRange(0, Math.floor((idx * seg) / c.segs));
    c.mesh.visible = grow > 0.001; c.mat.opacity = show;
  }
  for (const b of g.userData.beads) b.mat.opacity = show * smooth((s - FIN.stitch[0] + 0.05) / 0.08);
}
