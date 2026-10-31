import * as THREE from 'three';
import { STATIONS, cameraPose, viewOffset, NARROW, setOf, flightTime, shipTime, tipAt, shipPitch, shipBase } from './story.js';
import { boosterAt, shipAt, shipLanding } from './flight.js';
import { BOOSTER, SHIP, TOWER, R } from './dims.js';

const REGIONS = ['booster', 'ship', 'tower'];
export const PLAN_ASPECTS = [1.6, 390 / 844], FLY_TOP = 2400;
const LAST = STATIONS.length - 1;

function viewOf(aspect) {
  const wide = aspect > NARROW;
  const keep = wide
    ? [{ x0: -1, x1: -0.2, y0: -1, y1: 0.75 }, { x0: 0.55, x1: 1, y0: 0.72, y1: 1 }]
    : [{ x0: -1, x1: 1, y0: 0.84, y1: 1 }, { x0: -1, x1: 1, y0: -1, y1: -0.2 }];
  const prefer = wide ? [0.5, 0.3] : [0, 0.45];
  return { aspect, off: viewOffset(aspect), keep, prefer, size: wide ? 0.085 : 0.072 };
}
function viewCamera(t, v) {
  const p = cameraPose(t, v.aspect), H = 1000, Wd = H * v.aspect, cam = new THREE.PerspectiveCamera(p.fov, v.aspect, 1, 9000);
  cam.setViewOffset(Wd, H, v.off[0] * Wd, v.off[1] * H, Wd, H);
  cam.position.copy(p.position); cam.lookAt(p.target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  return { cam, depth: p.position.distanceTo(p.target) };
}

function subjects(s) {
  const out = [], T = flightTime(s), b = boosterAt(T), ax = (phi) => new THREE.Vector3(Math.sin(phi), Math.cos(phi), 0);
  const seg = (base, a, len, r) => { const p0 = new THREE.Vector3(...base), p1 = p0.clone().addScaledVector(a, len); return { p0, p1, r }; };
  if (setOf(s) === 'A') {
    out.push(seg(b.base, ax(b.phi), BOOSTER.height, R + 3.5));
    const sp = shipAt(T); out.push(seg(sp.base, ax(sp.phi), SHIP.height, R + 4));
    out.push({ p0: new THREE.Vector3(TOWER.x, 0, 0), p1: new THREE.Vector3(TOWER.x, TOWER.h + 2, 0), r: TOWER.w * 0.75 });
    out.push({ p0: new THREE.Vector3(TOWER.x + 8, 92, 0), p1: new THREE.Vector3(TOWER.x + 36, 92, 0), r: 14 });
    for (const z of [-140, -118, -96]) out.push({ p0: new THREE.Vector3(-170, 12, z), p1: new THREE.Vector3(-94, 12, z), r: 12 });
    if (T > 0 && T < 45) { const r = Math.min(70, 20 + 3 * T), h = Math.min(40, 10 + 2 * T); out.push({ p0: new THREE.Vector3(-r, h / 2, 0), p1: new THREE.Vector3(r, h / 2, 0), r: h / 2, soft: true }, { p0: new THREE.Vector3(0, h / 2, -r), p1: new THREE.Vector3(0, h / 2, r), r: h / 2, soft: true }); }
  } else {
    const L = shipLanding(shipTime(s)), tip = tipAt(s), pe = shipPitch(L, tip), base = shipBase(L, tip);
    out.push({ p0: base.clone(), p1: base.clone().addScaledVector(new THREE.Vector3(-Math.sin(pe), Math.cos(pe), 0), SHIP.height), r: R + 9 });
  }
  return out;
}
function screenBox(cam, sub) {
  const pts = [];
  for (const p of [sub.p0, sub.p1]) for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) pts.push(p.clone().add(new THREE.Vector3(...d).multiplyScalar(sub.r)).project(cam));
  return { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) };
}
function ndcDisc(cam, centre, r) {
  const p = centre.clone().project(cam), right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  const a = centre.clone().addScaledVector(right, r).project(cam), b = centre.clone().addScaledVector(up, r).project(cam);
  return { x: p.x, y: p.y, z: p.z, rx: Math.abs(a.x - p.x), ry: Math.abs(b.y - p.y) };
}
const overlaps = (m, b) => m.x0 < b.x1 && b.x0 < m.x1 && m.y0 < b.y1 && b.y0 < m.y1;
const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
const crosses = (a, b, c, d) => side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
const flat = (cam, p) => { const q = p.clone().project(cam); return q.z > 1 || q.z < -1 ? null : [q.x, q.y]; };
const boxOf = (q, lift = 0) => ({ x0: q.x - q.rx, x1: q.x + q.rx, y0: q.y - q.ry, y1: q.y + q.ry + lift });
const cx = (b) => (b.x0 + b.x1) / 2, cy = (b) => (b.y0 + b.y1) / 2;
const hangs = (lo, hi) => cx(lo) > hi.x0 && cx(lo) < hi.x1 && cy(hi) > cy(lo);
export function rimPoint(P, Q) { const d = Q.centre.clone().sub(P.centre); d.addScaledVector(P.normal, -d.dot(P.normal)); return P.centre.clone().addScaledVector(d.normalize(), P.radius); }
export function cordPath(A, B, n = 40) {
  const a = rimPoint(A, B), b = rimPoint(B, A), span = a.distanceTo(b), sag = Math.min(60, span * 0.12), pts = [];
  for (let k = 0; k <= n; k++) { const t = k / n; pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0))); }
  return { pts, span };
}
const polyCross = (P, Q) => { for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < Q.length - 1; j++) if (crosses(P[i], P[i + 1], Q[j], Q[j + 1])) return true; return false; };
const inBox = (p, b) => p[0] > b.x0 && p[0] < b.x1 && p[1] > b.y0 && p[1] < b.y1;

const SPOTS = [[0.62, 0.42], [0.8, 0.12], [0.45, 0.6], [0.82, 0.5], [0.3, 0.62], [0.62, -0.1], [0.84, -0.35], [0.12, 0.7]];
function candidates(v) {
  const grid = [];
  for (let y = 0.7; y >= -0.6; y -= 0.1) for (let x = -0.9; x <= 0.9001; x += 0.1) grid.push([+x.toFixed(2), +y.toFixed(2)]);
  grid.sort((a, b) => Math.hypot(a[0] - v.prefer[0], a[1] - v.prefer[1]) - Math.hypot(b[0] - v.prefer[0], b[1] - v.prefer[1]));
  return v.aspect > NARROW ? [...SPOTS, ...grid] : grid;
}

function nextChange(i, k) {
  for (let j = i + 1; j < LAST; j++) if (STATIONS[j].regions[k] !== STATIONS[i].regions[k]) return j;
  return null;
}

const PARK = { subject: 60, cut: 40, gone: 80, keep: 30, other: 24, soft: 8, string: 24 };
const MOVE = { subject: 15, cut: 1, gone: 0, keep: 3, other: 4, soft: 1, string: 3 };
const NEXT_PARK = { subject: 30, cut: 12, gone: 2, keep: 10, other: 12, soft: 3, string: 12 };
const NEXT_MOVE = { subject: 8, cut: 0, gone: 0, keep: 1, other: 2, soft: 0, string: 1 };
function cost(checks, centre, radius, v, why = null, keep = v.keep) {
  let bad = 0;
  const add = (ch, kind) => { const w = ch.w[kind]; if (!w) return; bad += w; if (why) why.push(`${kind}@${ch.t.toFixed(2)}`); };
  for (const ch of checks) {
    const q = ndcDisc(ch.cam, centre, radius * 1.15);
    if (q.z > 1 || q.z < -1) { add(ch, 'gone'); continue; }
    const me = boxOf(q, 0.06);
    if (me.x1 < -1 || me.x0 > 1 || me.y1 < -1 || me.y0 > 1) { add(ch, 'gone'); continue; }
    if (me.x0 < -0.98 || me.x1 > 0.98 || me.y0 < -0.98 || me.y1 > 0.98) add(ch, 'cut');
    if (ch.subs.some((b) => !b.soft && overlaps(me, b))) add(ch, 'subject');
    if (keep.some((b) => overlaps(me, b))) add(ch, 'keep');
    if (ch.subs.some((b) => b.soft && overlaps(me, b))) add(ch, 'soft');
    if (ch.others.some((o) => overlaps(me, o))) add(ch, 'other');
    if (ch.others.some((o) => hangs(o, me) || hangs(me, o)) || ch.subs.some((b) => !b.soft && hangs(me, b))) add(ch, 'string');
  }
  return bad;
}

const PLANS = new Map();
export function patchPlan(aspect = PLAN_ASPECTS[0]) {
  if (PLANS.has(aspect)) return PLANS.get(aspect);
  const v = viewOf(aspect), spots = candidates(v), out = [];
  STATIONS.forEach((st, i) => {
    if (i === LAST) return;
    const changed = REGIONS.filter((k) => i === 0 || st.regions[k] !== STATIONS[i - 1].regions[k]);
    if (!changed.length) return;
    const s = i + 0.2, set = setOf(s), { cam, depth } = viewCamera(s, v), f = new THREE.Vector3();
    cam.getWorldDirection(f);
    const d = depth + 120, hh = d * Math.tan((cam.fov * Math.PI) / 360), radius = v.size * hh;
    const at = (x, y) => { const dir = new THREE.Vector3(x, y, 0.5).unproject(cam).sub(cam.position).normalize(); return cam.position.clone().addScaledVector(dir, d / dir.dot(f)); };
    const here = [];
    const keep = v.aspect > NARROW || i > 0 ? v.keep : [...v.keep, { x0: -1, x1: 1, y0: -1, y1: 0.5 }];
    const parkCams = [i, i + 0.2].filter((t) => t <= LAST - 0.35 && setOf(t) === set).map((t) => { const { cam: c } = viewCamera(t, v); return { cam: c, subs: subjects(t).map((sub) => ({ ...screenBox(c, sub), soft: !!sub.soft })) }; });
    const seen = (q) => parkCams.every((ch) => { const d = ndcDisc(ch.cam, q.centre, q.radius * 1.15), me = boxOf(d, 0.06); return d.z < 1 && d.z > -1 && me.x0 > -0.98 && me.x1 < 0.98 && me.y0 > -0.98 && me.y1 < 0.98 && !keep.some((b) => overlaps(me, b)) && !ch.subs.some((b) => !b.soft && (overlaps(me, b) || hangs(me, b))); });
    const place = (k, label, reprise, alone = false) => {
      const j = reprise ? null : nextChange(i, k), revived = j === i + 1 && setOf(j + 0.2) === set, end = revived ? j + 1.15 : i + 1.15;
      const times = [[i, PARK], [i + 0.2, PARK], [i - 0.15, MOVE], [i + 0.45, MOVE], [i + 0.7, MOVE], [i + 0.95, MOVE]];
      if (revived) times.push([j, NEXT_PARK], [j + 0.2, NEXT_PARK], [j + 0.45, NEXT_MOVE], [j + 0.7, NEXT_MOVE]);
      const checks = [];
      for (const [t, w] of times) {
        if (t < 0 || t > LAST - 0.35 || setOf(t) !== set) continue;
        const { cam: c } = viewCamera(t, v);
        const others = out.filter((q) => q.set === set && t >= q.win[0] + 0.15 && t <= q.win[1] - 0.3).map((q) => boxOf(ndcDisc(c, q.centre, q.radius * 1.2)));
        checks.push({ t, cam: c, w, subs: subjects(t).map((sub) => ({ ...screenBox(c, sub), soft: !!sub.soft })), others });
      }
      const mine = here.map((q) => boxOf(ndcDisc(cam, q.centre, q.radius * 1.25)));
      const parked = checks.filter((ch) => ch.w === PARK);
      const from = reprise || alone ? null : here.find((q) => q.region === k && q.reprise) || [...out].reverse().find((q) => q.region === k && q.station === i - 1 && q.set === set);
      const normal = f.clone().negate();
      const lit = (ch) => [...here, ...out.filter((q) => q.set === set && !here.includes(q) && ch.t >= q.win[0] + 0.15 && ch.t <= q.win[1] - 0.3)];
      const lines = parked.map((ch) => ({ ch, lit: lit(ch).map((q) => ({ q, box: boxOf(ndcDisc(ch.cam, q.centre, q.radius)) })), others: here.filter((q) => q.from).map((q) => cordPath(q.from, q, 12).pts.map((p) => flat(ch.cam, p))).filter((P) => P.every(Boolean)) }));
      let best = null;
      for (const [x, y] of spots) {
        const centre = at(x, y);
        if (centre.y - radius < 6) continue;
        if (out.some((q) => q.set === set && q.station !== i && q.centre.distanceTo(centre) < (q.win[1] - i > 0.2 ? 1.4 : 1.05) * (q.radius + radius))) continue;
        const self = boxOf(ndcDisc(cam, centre, radius * 1.25));
        if (mine.some((b) => overlaps(self, b) || hangs(self, b) || hangs(b, self))) continue;
        let bad = cost(checks, centre, radius, v, null, keep);
        if (from) {
          const me = { centre, radius, normal }, path = cordPath(from, me, 12).pts;
          for (const L of lines) {
            const P = path.map((p) => flat(L.ch.cam, p));
            if (!P.every(Boolean)) continue;
            if (L.others.some((Q) => polyCross(P, Q))) bad += 18;
            const mid = P.slice(2, -2);
            if (L.ch.subs.some((box) => !box.soft && mid.some((p) => inBox(p, box)))) bad += 20;
            if (L.lit.some(({ q, box }) => q !== from && mid.some((p) => inBox(p, box)))) bad += 18;
          }
        }
        if (!best || bad < best.bad) best = { bad, centre };
        if (bad === 0) break;
      }
      if (!best) best = { bad: Infinity, centre: at(...spots[0]) };
      const why = [];
      cost(checks, best.centre, radius, v, why, keep);
      return { station: i, region: k, label, centre: best.centre, radius, normal, set, reprise, alone, from, misses: best.bad, why, win: [i - 0.25, end] };
    };
    const commit = (p) => { here.push(p); out.push(p); };
    const hidden = (p) => parkCams.every((ch) => { const d = ndcDisc(ch.cam, p.centre, p.radius); return d.z > 1 || d.z < -1 || Math.abs(d.x) > 1 || Math.abs(d.y) > 1 || keep.some((b) => d.x > b.x0 && d.x < b.x1 && d.y > b.y0 && d.y < b.y1); });
    changed.forEach((k) => {
      const prev = [...out].reverse().find((q) => q.region === k);
      if (!(prev && prev.set === set && (prev.station < i - 1 || !seen(prev)))) {
        const p = place(k, st.regions[k], false), solo = p.from ? place(k, st.regions[k], false, true) : p, best = solo.misses + 40 <= p.misses ? solo : p;
        if (!hidden(best)) commit(best);
        return;
      }
      const r = place(k, STATIONS[i - 1].regions[k], true);
      commit(r);
      const linked = place(k, st.regions[k], false);
      here.pop(); out.pop();
      const solo = place(k, st.regions[k], false, true);
      if (r.misses + linked.misses <= solo.misses + 20) { commit(r); commit(linked); } else commit(solo);
    });
  });
  PLANS.set(aspect, out);
  return out;
}

function feltMaterial(tex, atlas, label, region) {
  const base = { booster: '#26304f', ship: '#3a2f45', tower: '#2f4a43' }[region];
  if (tex.patches && atlas && atlas[label]) {
    const [col, row] = atlas[label], t = tex.patches.clone();
    t.repeat.set(1 / 5, 1 / 5); t.offset.set(col / 5, 1 - (row + 1) / 5); t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, transparent: true, alphaTest: 0.35, roughness: 1, emissive: new THREE.Color('#fff0d2'), emissiveIntensity: 0, side: THREE.DoubleSide });
  }
  return new THREE.MeshStandardMaterial({ color: base, roughness: 1, emissive: new THREE.Color('#ffcf73'), emissiveIntensity: 0, side: THREE.DoubleSide });
}

function cordTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#f3e7c6'; g.fillRect(0, 0, 128, 32);
  for (let x = -40; x < 168; x += 16) { g.fillStyle = '#e2b33f'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 0); g.lineTo(x + 40, 32); g.lineTo(x + 32, 32); g.closePath(); g.fill(); g.strokeStyle = 'rgba(58,42,20,0.55)'; g.lineWidth = 1.2; g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeThreads(tex = {}, atlas = null, aspect = PLAN_ASPECTS[0]) {
  const g = new THREE.Group(); g.name = 'statechart';
  const plan = patchPlan(aspect), patches = [];
  const cordTex = cordTexture();
  for (const p of plan) {
    const holder = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(p.radius, p.radius, p.radius * 0.06, 48), [new THREE.MeshStandardMaterial({ color: '#3b3346', roughness: 1, transparent: true }), feltMaterial(tex, atlas, p.label, p.region), feltMaterial(tex, atlas, p.label, p.region)]);
    disc.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    holder.add(disc);
    holder.position.copy(p.centre);
    holder.lookAt(p.centre.clone().add(p.normal));
    const top = p.centre.clone().add(new THREE.Vector3(0, p.radius, 0)), sky = top.clone().setY(FLY_TOP);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, FLY_TOP - top.y, 6), new THREE.MeshBasicMaterial({ color: '#d8ccb4', fog: true, transparent: true }));
    string.position.copy(top).add(sky).multiplyScalar(0.5);
    g.add(holder, string);
    patches.push({ ...p, holder, disc, top, string, mats: disc.material.slice(1), all: [...disc.material, string.material] });
  }
  const cords = [];
  for (const k of REGIONS) {
    const list = patches.filter((p) => p.region === k);
    for (let i = 1; i < list.length; i++) {
      const A = list[i - 1], B = list[i];
      if (A.set !== B.set || B.reprise || B.alone) continue;
      const { pts, span } = cordPath(A, B);
      if (span > 420) continue;
      const curve = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(curve, 80, 0.3 * Math.min(1.6, Math.max(1, span / 200)), 8, false);
      const mat = new THREE.MeshStandardMaterial({ map: cordTex ? cordTex.clone() : null, color: '#d8cdb6', roughness: 0.8, emissive: new THREE.Color('#e2b33f'), emissiveIntensity: 0, transparent: true });
      if (mat.map) { mat.map.repeat.set(span / 3, 1); mat.map.needsUpdate = true; }
      const m = new THREE.Mesh(geo, mat); m.castShadow = false; g.add(m);
      cords.push({ region: k, from: A, to: B, mesh: m, mat, pts });
    }
  }
  g.userData = { patches, cords, aspect };
  return g;
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const same = (c) => c.from.station === c.to.station;
const growFrom = (c) => c.to.station - (same(c) ? 0.2 : 0.3);
export function lightThreads(g, s) {
  const cur = Math.floor(s + 0.3);
  const fadeOut = (k) => smooth(1 - (s - (k + 0.6)) / 0.3);
  const life = (k) => Math.min(smooth((s - (k - 0.25)) / 0.25), fadeOut(k));
  for (const p of g.userData.patches) {
    const a = Math.max(life(p.station), ...g.userData.cords.filter((c) => c.from === p && !same(c)).map((c) => (s >= growFrom(c) - 0.1 ? fadeOut(c.to.station) : 0)));
    for (const m of p.all) { m.opacity = a; if (m.emissiveMap) m.alphaTest = Math.max(0.01, 0.35 * a); }
    p.holder.visible = p.string.visible = a > 0.01;
    for (const m of p.mats) m.emissiveIntensity = m.emissiveMap ? (p.station === cur ? 0.6 : 0.16) : (p.station === cur ? 0.5 : 0.04);
  }
  for (const c of g.userData.cords) {
    const grow = smooth((s - growFrom(c)) / (same(c) ? 0.2 : 0.3)), a = Math.min(grow > 0 ? 1 : 0, fadeOut(c.to.station));
    const idx = c.mesh.geometry.index.count, seg = Math.floor(grow * 80);
    c.mesh.geometry.setDrawRange(0, Math.floor((idx * seg) / 80));
    c.mesh.visible = grow > 0.001 && a > 0.01; c.mat.opacity = a;
    c.mat.color.set('#f2dfae');
    c.mat.emissiveIntensity = c.to.station === cur ? 0.22 : 0.06;
  }
}
