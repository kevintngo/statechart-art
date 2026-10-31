import * as THREE from 'three';
import { buildScene } from '../web/scene.js';
import { makeFX, applyPose, flameLength } from '../web/pose.js';
import { noseRadius, SHIELD } from '../web/props.js';
import { R, BOOSTER, SHIP, MOUNT, TOWER, ARMS, CARRIAGE, CATCH } from '../web/dims.js';
import { smokeState, CLOUDS } from '../web/effects.js';
import { FLY_TOP, lightThreads } from '../web/thread.js';
import { flightTime, setOf, STATIONS } from '../web/story.js';
import { TIMES } from '../web/flight.js';

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseChart } from '../web/chartdata.js';
const CHART = parseChart(fs.readFileSync(new URL('../model/chart/chart.mmd', import.meta.url), 'utf8'));
const LAYOUT = JSON.parse(fs.readFileSync(new URL('../out/layout.json', import.meta.url), 'utf8'));
const W = buildScene(), FX = makeFX(W, {}, { chart: CHART, layout: LAYOUT });
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function obbFromMesh(mesh) {
  const g = mesh.geometry; g.computeBoundingBox();
  const bb = g.boundingBox, c = bb.getCenter(v3()), h = bb.getSize(v3()).multiplyScalar(0.5);
  const m = mesh.matrixWorld, centre = c.clone().applyMatrix4(m);
  const ax = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)].map((a) => a.transformDirection(m));
  const sc = new THREE.Vector3(); m.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc);
  return { type: 'obb', c: centre, ax, h: [h.x * sc.x, h.y * sc.y, h.z * sc.z] };
}
const segOf = (obj, a, b, r) => ({ type: 'seg', flat: true, a: a.clone().applyMatrix4(obj.matrixWorld), b: b.clone().applyMatrix4(obj.matrixWorld), r });

function pointObb(p, o) {
  const d = p.clone().sub(o.c); let s = 0;
  for (let i = 0; i < 3; i++) { const t = d.dot(o.ax[i]), e = Math.max(0, Math.abs(t) - o.h[i]); s += e * e; }
  return Math.sqrt(s);
}
function insideObb(p, o) { const d = p.clone().sub(o.c); let worst = -Infinity; for (let i = 0; i < 3; i++) worst = Math.max(worst, Math.abs(d.dot(o.ax[i])) - o.h[i]); return worst; }
function segObb(a, b, o) {
  let lo = 0, hi = 1;
  const f = (t) => { const p = a.clone().lerp(b, t), d = pointObb(p, o); return d > 0 ? d : insideObb(p, o); };
  for (let i = 0; i < 60; i++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (f(m1) < f(m2)) hi = m2; else lo = m1; }
  return f((lo + hi) / 2);
}
function segSeg(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  if (a < 1e-12 && e < 1e-12) return p1.distanceTo(p2);
  if (a < 1e-12) { const t = Math.min(1, Math.max(0, f / e)); return p1.distanceTo(p2.clone().add(d2.multiplyScalar(t))); }
  if (e < 1e-12) { const t = Math.min(1, Math.max(0, -d1.dot(r) / a)); return p2.distanceTo(p1.clone().add(d1.multiplyScalar(t))); }
  let s, t; const c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
  s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  t = (b * s + f) / e; if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
  return p1.clone().add(d1.multiplyScalar(s)).distanceTo(p2.clone().add(d2.multiplyScalar(t)));
}
function obbObb(A, B) {
  const axes = [...A.ax, ...B.ax];
  for (const a of A.ax) for (const b of B.ax) { const c = a.clone().cross(b); if (c.lengthSq() > 1e-8) axes.push(c.normalize()); }
  let minOverlap = Infinity; const d = B.c.clone().sub(A.c);
  for (const L of axes) {
    const ra = A.h.reduce((s, h, i) => s + h * Math.abs(A.ax[i].dot(L)), 0), rb = B.h.reduce((s, h, i) => s + h * Math.abs(B.ax[i].dot(L)), 0);
    const gap = Math.abs(d.dot(L)) - (ra + rb);
    if (gap > 0) return gap;
    minOverlap = Math.min(minOverlap, -gap);
  }
  return -minOverlap;
}
function rimPoints(A) {
  const axis = A.b.clone().sub(A.a), L = axis.length(), u = axis.clone().normalize(), t1 = Math.abs(u.y) < 0.9 ? v3(0, 1, 0).cross(u).normalize() : v3(1, 0, 0).cross(u).normalize(), t2 = u.clone().cross(t1), pts = [];
  const rings = Math.max(2, Math.ceil(L / 0.8));
  for (let i = 0; i <= rings; i++) { const c = A.a.clone().addScaledVector(u, (L * i) / rings); for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; pts.push(c.clone().addScaledVector(t1, Math.cos(a) * A.r).addScaledVector(t2, Math.sin(a) * A.r)); } }
  for (const end of [A.a, A.b]) for (let r = A.r * 0.5; r > 0; r -= A.r * 0.5) for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; pts.push(end.clone().addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r)); }
  pts.push(A.a.clone(), A.b.clone());
  return pts;
}
function flatSegObb(A, B) {
  const capsule = segObb(A.a, A.b, B) - A.r;
  if (capsule >= 0 || A.r === 0) return capsule;
  let worst = Infinity;
  for (const p of rimPoints(A)) { const d = pointObb(p, B); worst = Math.min(worst, d > 0 ? d : insideObb(p, B)); }
  return worst;
}
function flatSegSeg(A, B) {
  const capsule = segSeg(A.a, A.b, B.a, B.b) - A.r - B.r;
  if (capsule >= 0) return capsule;
  const axis = B.b.clone().sub(B.a), L = axis.length(), u = axis.clone().normalize();
  let worst = Infinity;
  for (const p of rimPoints(A)) {
    const t = p.clone().sub(B.a).dot(u), radial = p.clone().sub(B.a).addScaledVector(u, -t).length();
    const outside = Math.max(-t, t - L, radial - B.r), d = outside > 0 ? Math.hypot(Math.max(0, -t, t - L), Math.max(0, radial - B.r)) : outside;
    worst = Math.min(worst, d);
  }
  return worst;
}
function dist(A, B) {
  if (A.type === 'seg' && B.type === 'seg') return A.flat || B.flat ? flatSegSeg(A, B) : segSeg(A.a, A.b, B.a, B.b) - A.r - B.r;
  if (A.type === 'seg' && B.type === 'obb') return A.flat ? flatSegObb(A, B) : segObb(A.a, A.b, B) - A.r;
  if (A.type === 'obb' && B.type === 'seg') return dist(B, A);
  if (A.type === 'obb' && B.type === 'obb') return obbObb(A, B);
  if (A.type === 'sphere') return dist({ type: 'seg', a: A.c, b: A.c, r: A.r }, B);
  if (B.type === 'sphere') return dist(A, { type: 'seg', a: B.c, b: B.c, r: B.r });
  throw new Error('pair ' + A.type + B.type);
}

const ringWedges = (() => {
  const out = [], n = 64, { rin, rout, top, thick } = MOUNT, half = rin * Math.tan(Math.PI / n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, c = v3(Math.cos(a) * (rin + rout) / 2, top - thick / 2, Math.sin(a) * (rin + rout) / 2);
    const ax = [v3(Math.cos(a), 0, Math.sin(a)), v3(0, 1, 0), v3(-Math.sin(a), 0, Math.cos(a))];
    out.push({ type: 'obb', c, ax, h: [(rout - rin) / 2, thick / 2, half], name: 'launch ring' });
  }
  return out;
})();

const named = (list, name) => list.map((p) => ({ ...p, name }));
function boosterParts() {
  const B = W.booster, ud = B.userData;
  return [
    { ...segOf(B, v3(0, 0, 0), v3(0, BOOSTER.body, 0), R), name: 'booster body' },
    { ...segOf(B, v3(0, -1.65, 0), v3(0, 0, 0), 4.15), name: 'booster engines' },
    ...ud.fins.map((f) => ({ ...obbFromMesh(f), name: 'grid fin' })),
    ...ud.pins.map((p) => ({ ...obbFromMesh(p), name: 'catch pin' })),
  ];
}
function ringParts() {
  const G = W.ring;
  return [{ ...segOf(G, v3(0, 0, 0), v3(0, BOOSTER.ring, 0), R), name: 'hot-stage ring' }];
}
function shieldPart() {
  const G = W.ring, m = G.matrixWorld, ax = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)].map((a) => a.transformDirection(m));
  return { type: 'obb', c: v3(0, SHIELD / 2, 0).applyMatrix4(m), ax, h: [R, SHIELD / 2, R], name: 'ring shield' };
}
function shipParts() {
  const S = W.ship, out = [{ ...segOf(S, v3(0, 0, 0), v3(0, SHIP.body, 0), R), name: 'ship body' }, { ...segOf(S, v3(0, -1.75, 0), v3(0, 0, 0), 4.15), name: 'ship engines' }];
  for (let y = SHIP.body; y < SHIP.height; y += 1.5) out.push({ ...segOf(S, v3(0, y, 0), v3(0, Math.min(SHIP.height, y + 1.5), 0), noseRadius(y)), name: 'ship nose' });
  for (const f of S.userData.flaps) out.push({ ...obbFromMesh(f), name: 'ship flap' });
  return out;
}
function towerParts() {
  const T = W.tower, out = [];
  T.traverse((o) => { if (o.isMesh && !o.material.isShaderMaterial) out.push({ ...obbFromMesh(o), name: o.name === 'arm' ? 'arm' : o.name === 'knuckle' ? 'knuckle' : o.parent === T.userData.carriage ? 'carriage' : 'tower' }); });
  return out;
}
function armParts() { return W.tower.userData.arms.map((p) => ({ ...obbFromMesh(p.children.find((c) => c.name === 'arm')), name: 'arm' })); }
function mountParts() {
  const out = [...ringWedges];
  W.mount.traverse((o) => { if (o.isMesh && !o.material.isShaderMaterial && o.geometry.type === 'BoxGeometry') out.push({ ...obbFromMesh(o), name: o.position.y > MOUNT.top ? 'clamp' : 'mount leg' }); });
  return out;
}
function mastParts() { const out = []; W.masts.traverse((o) => { if (o.isMesh && !o.material.isShaderMaterial) out.push({ ...obbFromMesh(o), name: 'light mast' }); }); return out; }
function farmParts() { const out = []; W.farm.traverse((o) => { if (o.isMesh && !o.material.isShaderMaterial && o.geometry.type === 'CylinderGeometry') out.push({ ...obbFromMesh(o), name: 'tank' }); }); return out; }
function flameParts(flame, owner, r, l) {
  if (!flame.visible) return [];
  const out = [], m = owner.matrixWorld;
  for (let k = 0; k < 6; k++) { const y0 = -l * (0.08 + k / 6 * 0.92), y1 = -l * (0.08 + (k + 1) / 6 * 0.92), rr = r * Math.pow(1 - (k / 6), 0.75); out.push({ type: 'seg', a: v3(0, y0, 0).applyMatrix4(m), b: v3(0, y1, 0).applyMatrix4(m), r: rr, name: 'flame' }); }
  return out;
}

const problems = new Map(), contacts = [];
function report(s, a, b, d, tol = -0.005) {
  if (d >= tol) return;
  const key = `${a} x ${b}`, cur = problems.get(key);
  if (!cur || d < cur.d) problems.set(key, { s: +s.toFixed(3), d: +d.toFixed(3), count: (cur ? cur.count : 0) + 1 }); else cur.count++;
}
function check(s, A, B, opts = {}) { for (const a of A) for (const b of B) { const d = dist(a, b); report(s, a.name, b.name, d, opts.tol); } }
function lowest(parts) { let m = Infinity; for (const p of parts) { if (p.type === 'seg') m = Math.min(m, p.a.y - p.r * Math.sqrt(1 - Math.pow((p.b.y - p.a.y) / (p.a.distanceTo(p.b) || 1), 2)), p.b.y - p.r * Math.sqrt(1 - Math.pow((p.b.y - p.a.y) / (p.a.distanceTo(p.b) || 1), 2))); else if (p.type === 'obb') { const ext = p.h.reduce((s, h, i) => s + h * Math.abs(p.ax[i].y), 0); m = Math.min(m, p.c.y - ext); } } return m; }

const PLANS = [['wide', FX.threads], ['phone', FX.threadsNarrow]];
const threadParts = (() => {
  const out = [];
  for (const [plan, g] of PLANS) {
    for (const p of g.userData.patches) {
      const n = p.normal.clone().normalize(), up = v3(0, 1, 0), right = up.clone().cross(n).normalize(), u2 = n.clone().cross(right).normalize();
      out.push({ type: 'obb', c: p.centre.clone(), ax: [right, u2, n], h: [p.radius, p.radius, p.radius * 0.03], name: `${plan} patch ${p.label}`, set: p.set, vis: p.holder });
      out.push({ type: 'seg', a: p.top.clone(), b: p.top.clone().setY(FLY_TOP), r: 0.12, name: `${plan} fly line`, set: p.set, vis: p.string });
    }
    for (const c of g.userData.cords) for (let i = 1; i < c.pts.length; i++) out.push({ type: 'seg', a: c.pts[i - 1], b: c.pts[i], r: 0.55, name: `${plan} cord`, set: c.from.set, vis: c.mesh });
  }
  return out;
})();
const finaleParts = (() => {
  const out = [];
  for (const p of FX.finale.userData.patches) { p.holder.updateMatrixWorld(true); const ax = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)].map((a) => a.transformDirection(p.holder.matrixWorld)); out.push({ type: 'obb', c: p.centre.clone(), ax, h: [9.5, 9.5, 0.3], name: 'finale patch', id: p.st.id }); out.push({ type: 'seg', a: p.lineEnds[0].clone(), b: p.lineEnds[1].clone(), r: 0.1, name: 'finale line', id: p.st.id }); }
  for (const t of FX.finale.userData.tags) { t.holder.updateMatrixWorld(true); const ax = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)].map((a) => a.transformDirection(t.holder.matrixWorld)); out.push({ type: 'obb', c: t.centre.clone(), ax, h: [20, 4.375, 0.1], name: 'finale tag', id: t.id }); out.push({ type: 'seg', a: t.lineEnds[0].clone(), b: t.lineEnds[1].clone(), r: 0.1, name: 'finale line', id: t.id }); }
  for (const c of FX.finale.userData.cords) { const pts = c.mesh.geometry.parameters.path.getSpacedPoints(c.segs); for (let i = 1; i < pts.length; i++) out.push({ type: 'seg', a: pts[i - 1], b: pts[i], r: 0.38, name: 'finale cord' }); }
  for (const b of FX.finale.userData.beads) out.push({ type: 'sphere', c: b.mesh.position.clone(), r: 1.3, name: 'finale bead' });
  return out;
})();
const STATIC = { farm: farmParts(), masts: mastParts() };
{ const cg = CARRIAGE.inner - TOWER.w / 2; if (cg < 0 || cg > 0.1) report(0, 'carriage', 'tower (no contact)', -Math.abs(cg) - 0.01); }
for (const c of CLOUDS) check(0, [{ type: 'sphere', c: v3(c.x, c.y, c.z), r: c.r * 0.75, name: 'cloud' }], threadParts.filter((t) => t.set === 'A'));
check(0, threadParts.filter((t) => t.set === 'A'), [...STATIC.farm, ...STATIC.masts]);
for (const c of CLOUDS) check(0, [{ type: 'sphere', c: v3(c.x, c.y, c.z), r: c.r * 0.75, name: 'cloud' }], STATIC.masts);
let prev = null, maxJump = { d: 0 };
for (let s = 0; s <= STATIONS.length - 1 + 0.4 + 1e-9; s += 0.01) {
  const info = applyPose(W, FX, s, 0), T = info.T, set = info.set;
  const bP = boosterParts(), sP = shipParts(), tP = towerParts(), mP = mountParts(), aP = armParts(), rP = ringParts(), shield = shieldPart(), ringOn = W.ring.visible;
  const attached = T < TIMES.SEP;
  if (set === 'A') {
    check(s, bP, [...tP, ...mP.filter((m) => m.name !== 'launch ring'), ...STATIC.masts]);
    check(s, [...sP, ...(ringOn ? rP : [])], STATIC.masts);
    check(s, bP.filter((p) => p.name !== 'booster body'), mP.filter((m) => m.name === 'launch ring'));
    check(s, [bP[0]], mP.filter((m) => m.name === 'launch ring'), { tol: -0.02 });
    check(s, sP, [...tP, ...mP]);
    if (ringOn) { check(s, rP, [...tP, ...mP]); check(s, sP.filter((p) => p.name !== 'ship engines'), rP); check(s, sP.filter((p) => p.name === 'ship engines'), [shield]); }
    if (ringOn && T >= TIMES.DROP) { check(s, rP, bP); check(s, [shield], bP); const gr = lowest(rP); if (gr < -0.005) report(s, 'hot-stage ring', 'ground', gr); }
    if (!attached) check(s, sP, bP);
    else check(s, sP.filter((p) => p.name !== 'ship engines'), bP.filter((p) => p.name !== 'booster body'));
    const g = lowest(bP); if (g < -0.005) report(s, 'booster', 'ground', g);
    const bf = flameLength(info.b, T), fl = flameParts(FX.bFlame, W.booster, bf.r, bf.l);
    check(s, fl, [...mP, ...tP]);
    for (const f of fl) { const lo = Math.min(f.a.y, f.b.y); if (lo < 0.2) report(s, 'flame', 'ground', lo - 0.2); }
    check(s, aP, tP.filter((p) => p.name === 'tower' || p.name === 'carriage'));
    for (const p of FX.smoke.userData.puffs) { const st = smokeState(p, T); if (!st || st.opacity < 0.05) continue; const sp = [{ type: 'sphere', c: v3(st.x, st.y, st.z), r: st.r * 0.62, name: 'smoke puff' }]; check(s, sp, [...mP, ...tP, ...bP, ...STATIC.farm, ...STATIC.masts]); }
    if (Math.round(s * 100) % 2 === 0) { lightThreads(FX.threadsNarrow, s); const lit = threadParts.filter((t) => t.set === 'A' && t.vis.visible); for (const p of FX.smoke.userData.puffs) { const st = smokeState(p, T); if (st && st.opacity >= 0.05) check(s, [{ type: 'sphere', c: v3(st.x, st.y, st.z), r: st.r * 0.62, name: 'smoke puff' }], lit); } }
    for (const c of CLOUDS) check(s, [{ type: 'sphere', c: v3(c.x, c.y, c.z), r: c.r * 0.7, name: 'cloud' }], [...bP.slice(0, 1), ...sP.slice(0, 1), ...(ringOn ? rP : [])]);
    if (FX.vents.visible) for (const p of FX.vents.userData.puffs) { if (p.s.material.opacity < 0.05) continue; check(s, [{ type: 'sphere', c: p.s.position.clone(), r: p.s.scale.y / 2.0 * 0.62, name: 'vent puff' }], [...bP, ...sP, ...tP, ...mP]); }
    if (Math.round(s * 100) % 5 === 0) { const tA = threadParts.filter((t) => t.set === 'A'); check(s, [...bP, ...sP, ...(ringOn ? rP : [])], tA); check(s, tP, tA); }
    if (info.b.hover && T >= TIMES.SETTLE[1]) {
      const pins = bP.filter((p) => p.name === 'catch pin');
      for (const pin of pins) { const bottom = pin.c.y - pin.h.reduce((a, h, i) => a + h * Math.abs(pin.ax[i].y), 0); contacts.push(bottom - CATCH.armTop); }
    }
  } else {
    if (Math.round(s * 100) % 5 === 0) check(s, sP, threadParts.filter((t) => t.set === 'C'));
    const low = lowest(sP), touched = s >= 11.0;
    if (!touched && low < -0.02) report(s, 'ship before touchdown', 'water', low);
    if (touched && low < -(R + 1.0)) report(s, 'floating ship', 'water (too deep)', low + R + 1.0);
  }
  if (prev) { for (const [name, now, was] of [['booster', W.booster.position, prev.b], ['ship', W.ship.position, prev.s], ...(W.ring.visible && prev.r ? [['ring', W.ring.position, prev.r]] : [])]) { const j = now.distanceTo(was); if (j > maxJump.d && !(name === 'ship' && (Math.abs(s - 8.7) < 0.02 || Math.abs(s - 11.7) < 0.02))) maxJump = { d: j, s, name }; } }
  prev = { b: W.booster.position.clone(), s: W.ship.position.clone(), r: W.ring.visible ? W.ring.position.clone() : null };
}

const { boosterAt: bAt } = await import('../web/flight.js');
let worstA = { a: 0 };
for (let T = TIMES.IGNITE; T < TIMES.CUT; T += 0.1) {
  const p = (t) => bAt(t).base, a = p(T - 0.1), b = p(T), c = p(T + 0.1);
  const acc = Math.hypot((c[0] - 2 * b[0] + a[0]) / 0.01, (c[1] - 2 * b[1] + a[1]) / 0.01);
  if (acc > worstA.a) worstA = { a: acc, T };
}
console.log('largest booster acceleration:', worstA.a.toFixed(2), 'world m/s^2 at T=' + worstA.T.toFixed(1), '(gravity is 1.2)');
const { FLATS } = await import('../web/flats.js');
const { cameraPose, viewOffset, shipTime, tipAt, shipCentre } = await import('../web/story.js');
const { shipLanding, LANDING_BURN } = await import('../web/flight.js');
const ASPECTS = [2.4, 1.6, 1.2, 1, 0.75, 390 / 844, 0.4];
const flatBoxes = FLATS.map((f) => ({ type: 'obb', c: v3((f.x0 + f.x1) / 2, f.bottom + f.height / 2, f.z), ax: [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)], h: [(f.x1 - f.x0) / 2, f.height / 2, 0.2], name: 'flat ' + (f.tex), set: f.set || 'A' }));
for (let s = 0; s <= 12.4; s += 0.01) {
  const info = applyPose(W, FX, s, 0);
  for (const aspect of ASPECTS) {
    const cam = cameraPose(s, aspect).position;
    check(s, [{ type: 'sphere', c: cam, r: 3, name: 'camera' }], flatBoxes.filter((f) => f.set === info.set));
    if (info.set === 'A' && Math.round(s * 100) % 4 === 0) for (const cl of CLOUDS) check(s, [{ type: 'sphere', c: cam, r: 3, name: 'camera' }], [{ type: 'sphere', c: v3(cl.x, cl.y, cl.z), r: cl.r * 1.2, name: 'cloud' }]);
  }
  if (Math.round(s * 100) % 4 === 0) { if (info.set === 'A') check(s, [...boosterParts(), ...shipParts(), ...(W.ring.visible ? ringParts() : [])], flatBoxes.filter((f) => f.set === 'A')); else check(s, shipParts(), flatBoxes.filter((f) => f.set === 'C')); }
}
for (const t of threadParts) check(0, [t], flatBoxes.filter((f) => f.set === (t.set || 'A')));
check(0, finaleParts, flatBoxes);
check(0, [...towerParts(), ...mountParts(), ...STATIC.farm, ...STATIC.masts], flatBoxes);
applyPose(W, FX, 12.4, 0);
check(12.4, finaleParts, [...boosterParts(), ...towerParts(), ...mountParts(), ...STATIC.farm]);
for (const c of CLOUDS) check(12.4, [{ type: 'sphere', c: v3(c.x, c.y, c.z), r: c.r * 0.75, name: 'cloud' }], finaleParts);
const fp = finaleParts.filter((p) => p.name === 'finale patch');
for (let i = 0; i < fp.length; i++) for (let j = i + 1; j < fp.length; j++) check(12.4, [fp[i]], [fp[j]], { tol: -0.005 });
check(12.4, finaleParts.filter((p) => p.name === 'finale cord' || p.name === 'finale bead'), fp);
const fl = finaleParts.filter((p) => p.name === 'finale line'), solid = finaleParts.filter((p) => p.name === 'finale patch' || p.name === 'finale tag');
const discs = FX.finale.userData.patches.map((p) => { const n = v3(0, 0, 1).transformDirection(p.holder.matrixWorld); return { type: 'seg', flat: true, a: p.centre.clone().addScaledVector(n, -0.3), b: p.centre.clone().addScaledVector(n, 0.3), r: 9.5, name: 'finale patch', id: p.st.id }; });
for (const l of fl) check(12.4, [...discs.filter((q) => q.id !== l.id), ...solid.filter((q) => q.name === 'finale tag' && q.id !== l.id)], [{ ...l, flat: true, a: l.a.clone().add(v3(0, 0.05, 0)), b: l.b.clone().add(v3(0, -0.35, 0)) }]);
check(12.4, finaleParts.filter((p) => p.name === 'finale tag'), [...fp, ...finaleParts.filter((p) => p.name === 'finale cord' || p.name === 'finale bead')]);
for (const [plan, g] of PLANS) for (const p of g.userData.patches) { const low = p.centre.y - p.radius; if (low < 0.5) report(p.station, `${plan} patch ${p.label}`, p.set === 'C' ? 'sea' : 'ground', low - 0.5); }
const discOf = (p, plan) => { const n = p.normal.clone().normalize(); return { type: 'seg', flat: true, a: p.centre.clone().addScaledVector(n, -p.radius * 0.03), b: p.centre.clone().addScaledVector(n, p.radius * 0.03), r: p.radius, name: `${plan} patch ${p.label}` }; };
for (const [plan, g] of PLANS) {
  const list = g.userData.patches;
  for (const p of list) {
    const disc = discOf(p, plan);
    for (const q of list) if (q !== p && q.set === p.set) check(0, [disc], [{ type: 'seg', a: q.top.clone(), b: q.top.clone().setY(FLY_TOP), r: 0.12, name: `${plan} fly line` }]);
    for (const q of list) if (q !== p && q.set === p.set && q.win[0] < p.win[1] && p.win[0] < q.win[1] && list.indexOf(q) > list.indexOf(p)) check(0, [disc], [discOf(q, plan)]);
    for (const c of g.userData.cords) if (c.from !== p && c.to !== p && c.from.set === p.set) for (let i = 1; i < c.pts.length; i++) check(0, [disc], [{ type: 'seg', a: c.pts[i - 1], b: c.pts[i], r: 0.55, name: `${plan} cord` }]);
  }
}
const near = (T, list) => list.some((x) => Math.abs(T - x) < 0.1);
{
  const events = [TIMES.IGNITE, TIMES.MECO, TIMES.BOOST[0], TIMES.BOOST[1], LANDING_BURN, TIMES.CUT];
  let prevL = null;
  for (let T = TIMES.IGNITE - 1; T < TIMES.CUT + 1; T += 0.005) {
    const l = flameLength(bAt(T), T).l;
    if (prevL !== null && Math.abs(l - prevL) > 1 && !near(T, events)) report(+T.toFixed(3), 'booster flame length', `a jump of ${Math.abs(l - prevL).toFixed(1)} m (T)`, -Math.abs(l - prevL));
    prevL = l;
  }
}
{
  const C = (s) => shipCentre(shipLanding(shipTime(s)), tipAt(s));
  let s0 = null;
  for (let s = 8.7; s < 11.0; s += 0.001) if (shipLanding(shipTime(s)).burn) { s0 = s; break; }
  let min = Infinity;
  for (let s = s0; s <= 11.0; s += 0.005) { const v = C(s + 0.0025).distanceTo(C(s - 0.0025)) / 0.005; if (v > min + 3) report(+s.toFixed(3), 'ship descent', 'speeds up during the landing burn (m per screen)', min - v); min = Math.min(min, v); }
  { const v = (s) => C(s + 0.0025).distanceTo(C(s - 0.0025)) / 0.005; let top = 0; for (let s = 8.75; s < s0; s += 0.005) { top = Math.max(top, v(s)); if (v(s) < top - 3) { report(+s.toFixed(3), 'ship descent', 'slows before its engines light (m per screen)', v(s) - top); break; } } const mean = v(s0) / (11.0 - s0); for (let s = s0; s < 10.99; s += 0.005) { const a = (v(s - 0.005) - v(s + 0.005)) / 0.01; if (a > 1.6 * mean) report(+s.toFixed(3), 'ship descent', 'brakes harder than 1.6x the burn mean (m per screen^2)', 1.6 * mean - a); } }
  const { flightTime } = await import('../web/story.js');
  const B = (s) => { const b = bAt(flightTime(s)); return v3(b.base[0] + Math.sin(b.phi) * BOOSTER.centre, b.base[1] + Math.cos(b.phi) * BOOSTER.centre, 0); };
  let sb = null;
  for (let s = 5; s < 8; s += 0.001) if (flightTime(s) >= LANDING_BURN) { sb = s; break; }
  min = Infinity;
  for (let s = sb; flightTime(s) <= TIMES.HOVER; s += 0.005) { const v = B(s + 0.0025).distanceTo(B(s - 0.0025)) / 0.005; if (v > min + 3) report(+s.toFixed(3), 'booster descent', 'speeds up during the landing burn (m per screen)', min - v); min = Math.min(min, v); }
}
{
  const tools = createRequire(new URL('../../tools/package.json', import.meta.url)), { loadImage, createCanvas } = tools('@napi-rs/canvas');
  const alpha = {};
  for (const f of FLATS) if (!alpha[f.tex]) {
    const im = await loadImage(fileURLToPath(new URL(`../out/tex/${f.tex}.png`, import.meta.url))), cv = createCanvas(im.width, im.height), g = cv.getContext('2d');
    g.drawImage(im, 0, 0);
    alpha[f.tex] = { w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data };
  }
  const fhash = (n) => { const x = Math.sin(n * 91.7 + 13.3) * 43758.5453; return x - Math.floor(x); };
  const endCut = (u) => { const x = Math.round((u * 1024) / 4) * 4, e = Math.min(1, x / 1024 / 0.06, (1 - x / 1024) / 0.06); return Math.min(1, e * (0.92 + 0.08 * fhash(x))); };
  const flats = FLATS.map((f) => ({ ...f, rep: Math.max(1, Math.round((f.x1 - f.x0) / (f.height * 6))) * (f.flip ? -1 : 1) }));
  const flatHit = (ray, set) => {
    let best = null;
    for (const f of flats) {
      if ((f.set || 'A') !== set) continue;
      const t = (f.z - ray.origin.z) / ray.direction.z; if (!(t > 0)) continue;
      const p = ray.origin.clone().addScaledVector(ray.direction, t);
      if (p.x < f.x0 || p.x > f.x1 || p.y < f.bottom || p.y > f.bottom + f.height) continue;
      const up = (p.x - f.x0) / (f.x1 - f.x0), v = (p.y - f.bottom) / f.height;
      if (f.tex.startsWith('dunes') && v > endCut(up)) continue;
      let u = up * f.rep; u -= Math.floor(u);
      const A = alpha[f.tex], x = Math.min(A.w - 1, Math.floor(u * A.w)), y = Math.min(A.h - 1, Math.floor((1 - v) * A.h));
      if (A.d[(y * A.w + x) * 4 + 3] < 102) continue;
      if (!best || t < best) best = t;
    }
    return best;
  };
  const Cs = FX.setC.userData, nightSet = [Cs.sky, Cs.sea, Cs.moon], SHAPES = [[1440, 900], [1280, 800], [1920, 1080], [2560, 1440], [2560, 1080], [3440, 1440], [3440, 1300], [2560, 960], [3840, 1080], [1600, 500], [1024, 768], [820, 1180], [390, 844], [844, 390]];
  const rays = [];
  for (let i = 0; i <= 12; i++) { const k = -1 + (2 * i) / 12; rays.push([k, -1], [k, 1], [-1, k], [1, k], [k, 0]); }
  const rc = new THREE.Raycaster(), cam = new THREE.PerspectiveCamera(36, 1, 1, 9000), leaks = new Map();
  for (let s = 0; s <= 12.4; s += 0.04) {
    const info = applyPose(W, FX, s, 0), set = info.set;
    const meshes = [W.backdrop, W.ground, W.sea, ...nightSet].filter((m) => { for (let o = m; o; o = o.parent) if (!o.visible) return false; return true; });
    for (const [w, h] of SHAPES) {
      const aspect = w / h, p = cameraPose(s, aspect), [ox, oy] = viewOffset(aspect);
      cam.aspect = aspect; cam.fov = p.fov; cam.setViewOffset(w, h, ox * w, oy * h, w, h); cam.updateProjectionMatrix();
      cam.position.copy(p.position); cam.lookAt(p.target); cam.updateMatrixWorld();
      for (const [x, y] of rays) {
        rc.setFromCamera(new THREE.Vector2(x, y), cam);
        const hit = rc.intersectObjects(meshes, true)[0], ft = flatHit(rc.ray, set);
        if (ft !== null && (!hit || ft < hit.distance)) continue;
        let kind = null;
        if (!hit) kind = 'the bare background';
        else if (set === 'A' && nightSet.includes(hit.object)) kind = 'the night set';
        else if (set === 'C' && !nightSet.includes(hit.object)) kind = 'the dawn set';
        else if (hit.object === W.backdrop && hit.point.y < -0.5) kind = 'the sky card below the ground';
        if (!kind) continue;
        const key = `${w}x${h} sees ${kind}`, cur = leaks.get(key);
        if (!cur) leaks.set(key, { from: s, to: s, n: 1 }); else { cur.to = s; cur.n++; }
      }
    }
  }
  for (const [k, v] of leaks) problems.set(`screen ${k} (s ${v.from.toFixed(2)} to ${v.to.toFixed(2)})`, { s: +v.from.toFixed(2), d: -1, count: v.n });
}

console.log(problems.size ? 'PENETRATIONS (negative = metres inside):' : 'no penetrations');
for (const [k, v] of [...problems.entries()].sort((a, b) => a[1].d - b[1].d)) console.log(`  ${k}: ${v.d} m at s=${v.s} (${v.count} samples)`);
console.log('catch pins resting gap on the arms (should be ~0):', contacts.length ? contacts.slice(-2).map((d) => d.toFixed(3)).join(', ') : 'none sampled');
console.log('largest jump between samples:', maxJump.d.toFixed(2), 'm', maxJump.name, 'at s=' + (maxJump.s || 0).toFixed(2));
process.exit(problems.size ? 1 : 0);
