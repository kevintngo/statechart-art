'use strict';
const M = require('./media');
const { D } = M;
const { rng } = require('../../tools/kit/util');

const TAU = Math.PI * 2;
const C = {
  ink: '#1d1a1e', cream: '#f3e9d2', ivory: '#fbf6ea', gold: '#e2b33f', ochre: '#c99a3a', rose: '#d9727a', blush: '#f2b9c2', coral: '#e0675c',
  red: '#c4453a', deepRed: '#933323', sage: '#9dbb86', sageDeep: '#6f9460', mint: '#bfe0cf', sky: '#a9cfe0', slate: '#8fa9bf', lilac: '#c6b6de',
  plum: '#6b4a7a', tea: '#a8693f', umber: '#5a3d22', peach: '#f2c3a0', teal: '#3f7f86', navy: '#24365c', wine: '#7a2f45', butter: '#f3d78f',
};

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const perp = (a) => [-a[1], a[0]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rot = (p, c, ang) => { const s = Math.sin(ang), co = Math.cos(ang), d = sub(p, c); return [c[0] + d[0] * co - d[1] * s, c[1] + d[0] * s + d[1] * co]; };

function blob(cx, cy, rx, ry, seed, o = {}) {
  const R = rng('blob:' + seed), n = o.n ?? 10, wob = o.wob ?? 0.08, ang = o.rot ?? 0, ctrl = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + (R() - 0.5) * 0.25, k = 1 + (R() - 0.5) * 2 * wob; ctrl.push(rot([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k], [cx, cy], ang)); }
  return D.curve(ctrl, true, o.step ?? 0.6);
}
function tube(pts, r, o = {}) {
  const s = D.resample(pts, 0.4), L = [], Rr = [], rad = typeof r === 'function' ? r : () => r;
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)], n = perp(norm(sub(b, a))), w = rad(i / (s.length - 1));
    L.push(add(s[i], mul(n, w))); Rr.push(sub(s[i], mul(n, w)));
  }
  const cap = (c, d, w, flip) => { const out = [], base = Math.atan2(d[1], d[0]); for (let k = 1; k < 8; k++) { const a = base + (flip ? -1 : 1) * (Math.PI / 2 - (k / 8) * Math.PI); out.push([c[0] + Math.cos(a) * w, c[1] + Math.sin(a) * w]); } return out; };
  const d0 = norm(sub(s[0], s[1])), d1 = norm(sub(s[s.length - 1], s[s.length - 2]));
  const end = o.flat ? [] : cap(s[s.length - 1], d1, rad(1), false), start = o.flat ? [] : cap(s[0], d0, rad(0), false);
  return [...L, ...end, ...Rr.reverse(), ...start];
}
function capsule(a, b, r) { return tube([a, b], r); }

function wash(P, poly, color, q = {}) { P.fill([poly], color, { tool: q.tool || 'pastelpencil', pressure: q.pressure ?? 0.35, passes: q.passes ?? 1, angle: q.angle ?? 30 }); }

function glow(P, cx, cy, r, color, q = {}) {
  const steps = q.steps ?? 4;
  for (let i = 0; i < steps; i++) { const k = 1 - i / steps; P.fill([blob(cx, cy, r * k, (q.ry ?? r) * k, `glow${cx}${cy}${i}`, { wob: 0.12 })], color, { tool: 'pastelpencil', pressure: (q.pressure ?? 0.22) + i * 0.06, passes: 1, angle: 20 + i * 40 }); }
}

function squiggle(R, cx, cy, rx, ry, steps, stepLen) {
  const pts = []; let x = cx + (R() - 0.5) * rx, y = cy + (R() - 0.5) * ry, a = R() * TAU;
  for (let i = 0; i < steps; i++) {
    a += (R() - 0.5) * 1.6; x += Math.cos(a) * stepLen; y += Math.sin(a) * stepLen;
    const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy > 0.8) { a = Math.atan2(cy - y, cx - x) + (R() - 0.5); x += Math.cos(a) * stepLen; y += Math.sin(a) * stepLen; }
    pts.push([x, y]);
  }
  return D.curve(pts, false, 0.3);
}

function nucleus(P, cx, cy, rx, ry, seed, pal, q = {}) {
  const R = rng('nuc:' + seed), shape = blob(cx, cy, rx, ry, seed + 'n', { wob: 0.06 });
  P.fill([shape], pal.nucleus, { tool: pal.tool || 'pencil', pressure: 0.72, passes: 2 });
  P.fill([blob(cx - rx * 0.18, cy - ry * 0.2, rx * 0.6, ry * 0.55, seed + 'h', { wob: 0.1 })], pal.nucleusLight || pal.nucleus, { tool: pal.tool || 'pencil', pressure: 0.4, passes: 1 });
  for (let i = 0; i < (q.threads ?? 7); i++) P.line(squiggle(R, cx, cy, rx * 0.8, ry * 0.8, 14, Math.min(rx, ry) * 0.18), { tool: pal.threadTool || 'pencil', color: pal.chromatin, pressure: 0.85, tremor: 0.6 });
  if (q.nucleolus !== false) { const nl = blob(cx + rx * 0.25, cy + ry * 0.15, rx * 0.2, ry * 0.18, seed + 'nl'); P.fill([nl], pal.nucleolus, { tool: pal.tool || 'pencil', pressure: 0.95, passes: 3 }); }
  P.outline([shape], { color: pal.envelope, nib: pal.nib ?? 0.35 });
  const inner = blob(cx, cy, rx * 0.93, ry * 0.93, seed + 'n', { wob: 0.06 }), chunk = Math.max(6, Math.round(inner.length / 14));
  for (let i = 0; i < inner.length; i += chunk) P.line(inner.slice(i, i + Math.round(chunk * 0.7)), { tool: 'fineliner', color: pal.envelope, nib: (pal.nib ?? 0.35) * 0.55, tremor: 0.4 });
  return shape;
}

function mito(P, cx, cy, l, w, ang, pal, seed) {
  const a = [cx - Math.cos(ang) * l / 2, cy - Math.sin(ang) * l / 2], b = [cx + Math.cos(ang) * l / 2, cy + Math.sin(ang) * l / 2], mid = add(lerp(a, b, 0.5), mul(perp(norm(sub(b, a))), w * 0.25));
  const body = tube(D.curve([a, mid, b], false, 0.3), w / 2);
  P.fill([body], pal.mito, { tool: pal.tool || 'pencil', pressure: 0.8, passes: 2 });
  const n = Math.max(3, Math.round(l / (w * 0.55))), R = rng('mito:' + seed);
  const crista = [];
  for (let i = 0; i <= n * 4; i++) { const t = i / (n * 4), p = lerp(a, b, 0.1 + t * 0.8), off = Math.sin(t * n * Math.PI) * w * 0.32 * (R() * 0.3 + 0.7); crista.push(add(p, mul(perp(norm(sub(b, a))), off))); }
  P.line(crista, { tool: 'fineliner', color: pal.mitoLine, nib: 0.2, tremor: 0.4 });
  P.outline([body], { color: pal.line, nib: 0.28 });
}

function cell(P, o) {
  const pal = o.pal, R = rng('cell:' + o.seed);
  const body = blob(o.cx, o.cy, o.rx, o.ry, o.seed, { wob: o.wob ?? 0.05, n: 12, rot: o.rot || 0 });
  P.fill([body], pal.cyto, { tool: pal.tool || 'pencil', pressure: o.pressure ?? 0.6, passes: 2, angle: 40 });
  if (pal.shade) P.fill([blob(o.cx + o.rx * 0.18, o.cy + o.ry * 0.22, o.rx * 0.82, o.ry * 0.78, o.seed + 's', { wob: 0.06 })], pal.shade, { tool: pal.tool || 'pencil', pressure: 0.32, passes: 1, angle: -30, clip: [body] });
  if (pal.ribo) P.stipple([blob(o.cx, o.cy, o.rx * 0.92, o.ry * 0.92, o.seed + 'r')], pal.ribo, { tool: 'fineliner', nib: 0.22, density: o.ribo ?? 0.5, size: 0.9 });
  if (o.organelles !== false) {
    const nm = o.mito ?? 6;
    for (let i = 0; i < nm; i++) { const a = R() * TAU, rr = 0.62 + R() * 0.24; mito(P, o.cx + Math.cos(a) * o.rx * rr, o.cy + Math.sin(a) * o.ry * rr, Math.min(o.rx, o.ry) * (0.28 + R() * 0.12), Math.min(o.rx, o.ry) * 0.11, a + Math.PI / 2 + (R() - 0.5), pal, o.seed + i); }
    if (pal.er) for (let k = 0; k < 3; k++) { const a0 = R() * TAU, pts = []; for (let i = 0; i <= 24; i++) { const a = a0 + (i / 24) * 1.4, r = 0.46 + k * 0.06 + Math.sin(i * 0.9) * 0.02; pts.push([o.cx + Math.cos(a) * o.rx * r, o.cy + Math.sin(a) * o.ry * r]); } P.line(pts, { tool: 'pencil', color: pal.er, pressure: 0.9, blunt: true }); }
    if (pal.vesicle) for (let i = 0; i < (o.vesicles ?? 9); i++) { const a = R() * TAU, rr = 0.4 + R() * 0.5, x = o.cx + Math.cos(a) * o.rx * rr, y = o.cy + Math.sin(a) * o.ry * rr, r = Math.min(o.rx, o.ry) * (0.03 + R() * 0.03); P.fill([D.ell(x, y, r, r)], pal.vesicle, { tool: pal.tool || 'pencil', pressure: 0.9, passes: 2 }); P.outline([D.ell(x, y, r, r)], { color: pal.line, nib: 0.18 }); }
  }
  if (o.nucleus !== false) nucleus(P, o.cx + (o.nx ?? 0), o.cy + (o.ny ?? 0), o.rx * (o.nr ?? 0.36), o.ry * (o.nr ?? 0.36) * 1.04, o.seed, pal, { threads: o.threads });
  P.outline([body], { color: pal.line, nib: pal.membraneNib ?? 0.45 });
  P.outline([blob(o.cx, o.cy, o.rx - 1.1, o.ry - 1.1, o.seed, { wob: o.wob ?? 0.05, n: 12, rot: o.rot || 0 })], { color: pal.line, nib: 0.18 });
  return body;
}

function helix(P, a, b, o) {
  const dir = norm(sub(b, a)), n = perp(dir), L = len(sub(b, a)), amp = o.amp ?? 3, per = o.period ?? 11, step = 0.25, R = rng('hx:' + (o.seed || ''));
  const strand = (ph) => { const pts = []; for (let s = 0; s <= L; s += step) pts.push({ s, p: add(add(a, mul(dir, s)), mul(n, Math.sin((s / per) * TAU + ph) * amp * (o.taper ? o.taper(s / L) : 1))), z: Math.cos((s / per) * TAU + ph) }); return pts; };
  const s1 = strand(0), s2 = strand(Math.PI);
  const rungs = [], rungStep = per / 10;
  for (let s = rungStep / 2; s < L; s += rungStep) {
    const i = Math.round(s / step), p = s1[Math.min(i, s1.length - 1)].p, q = s2[Math.min(i, s2.length - 1)].p, t = s / L;
    if (o.skip && o.skip(t)) continue;
    const c = o.rungColor ? o.rungColor(t, R) : o.bases[Math.floor(R() * o.bases.length)];
    rungs.push({ p, q, c, t });
  }
  for (const r of rungs) { const m = lerp(r.p, r.q, 0.5); P.line([r.p, m], { tool: o.rungTool || 'pencil', color: r.c, pressure: 0.95, blunt: true, tremor: 0.3 }); P.line([m, r.q], { tool: o.rungTool || 'pencil', color: o.pair ? o.pair(r.c) : r.c, pressure: 0.95, blunt: true, tremor: 0.3 }); }
  const drawStrand = (S, color, front) => { let seg = []; for (const q of S) { const isFront = q.z > 0; if (isFront === front) seg.push(q.p); else { if (seg.length > 1) { if (o.edge) P.line(seg, { tool: 'fineliner', color: o.edge, nib: o.edgeNib ?? 1.5, tremor: 0.25 }); P.line(seg, { tool: o.tool || 'pastelpencil', color, pressure: 0.98, blunt: o.blunt, tremor: 0.25 }); } seg = []; } } if (seg.length > 1) { if (o.edge) P.line(seg, { tool: 'fineliner', color: o.edge, nib: o.edgeNib ?? 1.5, tremor: 0.25 }); P.line(seg, { tool: o.tool || 'pastelpencil', color, pressure: 0.98, blunt: o.blunt, tremor: 0.25 }); } };
  drawStrand(s1, o.back1 || o.c1, false); drawStrand(s2, o.back2 || o.c2, false);
  drawStrand(s1, o.c1, true); drawStrand(s2, o.c2, true);
  return { s1, s2, dir, n };
}

function chromatidArm(c, ang, l, w) { const tip = [c[0] + Math.cos(ang) * l, c[1] + Math.sin(ang) * l]; return tube([c, lerp(c, tip, 0.5), tip], (t) => w * (0.62 + 0.38 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2))); }
function chromosome(P, cx, cy, o) {
  const ang = o.angle ?? 0, l = o.len ?? 10, w = o.width ?? 2.2, R = rng('chr:' + (o.seed || cx + ',' + cy)), gap = w * 0.48, spread = o.spread ?? 0.22;
  const arms = [];
  const sides = o.single ? [0] : [-1, 1];
  for (const sd of sides) {
    const c = [cx + Math.cos(ang) * gap * sd * 0.55, cy + Math.sin(ang) * gap * sd * 0.55];
    const up = ang - Math.PI / 2 + sd * spread, dn = ang + Math.PI / 2 - sd * spread;
    arms.push({ poly: chromatidArm(c, up + (o.bend ? o.bend * sd : 0), l * (o.p ?? 0.42), w / 2), c, a: up, L: l * (o.p ?? 0.42) });
    arms.push({ poly: chromatidArm(c, dn - (o.bend ? o.bend * sd : 0), l * (1 - (o.p ?? 0.42)), w / 2), c, a: dn, L: l * (1 - (o.p ?? 0.42)) });
  }
  for (const [i, arm] of arms.entries()) {
    P.fill([arm.poly], o.colors[(Math.floor(i / 2)) % o.colors.length], { tool: o.tool || 'pastelpencil', pressure: o.pressure ?? 0.95, passes: 2, angle: (ang * 180) / Math.PI + 30 });
    if (o.bands) for (let k = 1; k < 4; k++) { const t = 0.2 + k * 0.2 + (R() - 0.5) * 0.08, p = [arm.c[0] + Math.cos(arm.a) * arm.L * t, arm.c[1] + Math.sin(arm.a) * arm.L * t], nn = [Math.cos(arm.a + Math.PI / 2), Math.sin(arm.a + Math.PI / 2)], bw = w * 0.55; P.line([add(p, mul(nn, bw)), sub(p, mul(nn, bw))], { tool: o.tool || 'pastelpencil', color: o.bands, pressure: 0.9, tremor: 0.3, clip: [arm.poly] }); }
  }
  if (o.line) for (const arm of arms) P.outline([arm.poly], { color: o.line, nib: o.nib ?? 0.25 });
  if (o.kinetochore) P.dot(cx, cy, w * 0.3, o.kinetochore, { tool: o.tool || 'pastelpencil' });
  return arms;
}

function aster(P, cx, cy, o) {
  const R = rng('aster:' + cx + ',' + cy), n = o.rays ?? 36;
  if (o.glow) glow(P, cx, cy, o.r0 * 2.6, o.glow, { pressure: 0.16 });
  for (let i = 0; i < n; i++) {
    const a = (o.from ?? 0) + ((o.span ?? TAU) * (i + R() * 0.6)) / n, l = o.r0 + (o.r1 - o.r0) * (0.45 + R() * 0.55), bend = (R() - 0.5) * 0.12;
    const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10, aa = a + bend * t; pts.push([cx + Math.cos(aa) * (o.r0 * 0.4 + l * t), cy + Math.sin(aa) * (o.r0 * 0.4 + l * t)]); }
    P.line(pts, { tool: o.tool || 'gel', color: i % 3 === 0 && o.c2 ? o.c2 : o.c1, nib: o.nib ?? 0.35, pressure: 0.9, tremor: 0.35 });
  }
  for (const [dx, a] of [[-1, 0.3], [1, 1.9]]) { const c = [cx + dx * o.r0 * 0.35, cy], q = capsule(add(c, [Math.cos(a) * o.r0 * 0.45, Math.sin(a) * o.r0 * 0.45]), sub(c, [Math.cos(a) * o.r0 * 0.45, Math.sin(a) * o.r0 * 0.45]), o.r0 * 0.22); P.fill([q], o.core || o.c1, { tool: 'pastelpencil', pressure: 1, passes: 3 }); }
}

function rays(P, origin, angles, o) {
  for (const [i, a] of angles.entries()) {
    const l = o.len * (0.8 + 0.25 * Math.sin(i * 2.1)), w = o.width * (0.7 + 0.3 * Math.cos(i * 1.7));
    const tip = [origin[0] + Math.cos(a) * l, origin[1] + Math.sin(a) * l], n = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)];
    const poly = [add(origin, mul(n, w * 0.15)), add(tip, mul(n, w / 2)), sub(tip, mul(n, w / 2)), sub(origin, mul(n, w * 0.15))];
    P.fill([poly], o.color, { tool: 'pastelpencil', pressure: o.pressure ?? 0.35, passes: 1, angle: (a * 180) / Math.PI });
  }
}

function voronoi(rect, pts) {
  const cells = [];
  for (const [i, p] of pts.entries()) {
    let poly = [[rect.x0, rect.y0], [rect.x1, rect.y0], [rect.x1, rect.y1], [rect.x0, rect.y1]];
    for (const [j, q] of pts.entries()) {
      if (i === j || Math.abs(q[0] - p[0]) > 40 || Math.abs(q[1] - p[1]) > 40) continue;
      const m = lerp(p, q, 0.5), nrm = sub(q, p), out = [];
      const inside = (v) => (v[0] - m[0]) * nrm[0] + (v[1] - m[1]) * nrm[1] <= 0;
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length], ia = inside(a), ib = inside(b);
        if (ia) out.push(a);
        if (ia !== ib) { const da = (a[0] - m[0]) * nrm[0] + (a[1] - m[1]) * nrm[1], db = (b[0] - m[0]) * nrm[0] + (b[1] - m[1]) * nrm[1], t = da / (da - db); out.push(lerp(a, b, t)); }
      }
      poly = out;
      if (poly.length < 3) break;
    }
    if (poly.length >= 3) cells.push({ site: p, poly });
  }
  return cells;
}
function inset(poly, d) {
  const c = poly.reduce((s, p) => add(s, p), [0, 0]).map((v) => v / poly.length);
  return poly.map((p) => { const v = sub(p, c), l = len(v); return add(c, mul(v, Math.max(0.2, (l - d) / l))); });
}
function rounded(poly, k = 3) { let p = poly; for (let i = 0; i < k; i++) { const q = []; for (let j = 0; j < p.length; j++) { const a = p[j], b = p[(j + 1) % p.length]; q.push(lerp(a, b, 0.25), lerp(a, b, 0.75)); } p = q; } return p; }

function scatter(seed, rect, n, minD, avoid = () => false) {
  const R = rng('sc:' + seed), out = [];
  for (let tries = 0; tries < n * 40 && out.length < n; tries++) {
    const p = [rect.x0 + R() * (rect.x1 - rect.x0), rect.y0 + R() * (rect.y1 - rect.y0)];
    if (avoid(p) || out.some((q) => len(sub(p, q)) < minD)) continue;
    out.push(p);
  }
  return out;
}

module.exports = { C, TAU, add, sub, mul, len, norm, perp, lerp, rot, blob, tube, capsule, wash, glow, squiggle, nucleus, mito, cell, helix, chromosome, chromatidArm, aster, rays, voronoi, inset, rounded, scatter };
