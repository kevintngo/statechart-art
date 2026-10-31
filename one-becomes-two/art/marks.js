'use strict';
const M = require('./media');
const { D } = M;
const { rng } = require('../../tools/kit/util');

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);

function lengthOf(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += len(sub(pts[i], pts[i - 1])); return s; }
function cut(pts, a, b) {
  const total = lengthOf(pts), from = Math.max(0, a), to = Math.max(from, total - b), out = [];
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i], d = len(sub(q, p));
    if (!d) continue;
    const at = (t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    if (s + d >= from && s <= to) { if (!out.length) out.push(at(Math.max(0, (from - s) / d))); out.push(at(Math.min(1, (to - s) / d))); }
    s += d;
  }
  return out;
}
function at(pts, t) {
  const total = lengthOf(pts) * t;
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = len(sub(pts[i], pts[i - 1]));
    if (s + d >= total) { const u = d ? (total - s) / d : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]; }
    s += d;
  }
  return pts[pts.length - 1];
}
function resample(pts, step) { const L = lengthOf(pts), n = Math.max(2, Math.ceil(L / step)), out = []; for (let i = 0; i <= n; i++) out.push(at(pts, i / n)); return out; }
function smoothPts(pts, iters = 2) {
  let p = pts;
  for (let k = 0; k < iters; k++) { const q = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q.push(p[p.length - 1]); p = q; }
  return p;
}

function strands(pts, amp, period) {
  const s = resample(pts, 0.25), A = [], B = [];
  let acc = 0;
  for (let i = 0; i < s.length; i++) {
    const p = s[i], q = s[Math.min(s.length - 1, i + 1)], r = s[Math.max(0, i - 1)], d = sub(q, r), l = len(d) || 1, n = [-d[1] / l, d[0] / l];
    if (i) acc += len(sub(s[i], s[i - 1]));
    const w = amp * Math.sin((acc / period) * Math.PI * 2);
    A.push({ p: [p[0] + n[0] * w, p[1] + n[1] * w], s: acc }); B.push({ p: [p[0] - n[0] * w, p[1] - n[1] * w], s: acc });
  }
  return { A, B, total: acc };
}

function cord(P, pts, th) {
  const { A, B } = strands(pts, th.amp ?? 0.75, th.period ?? 3.6), half = (th.period ?? 3.6) / 2, segs = [];
  const split = (S, which) => { let cur = [], idx = 0; for (const q of S) { const i = Math.floor(q.s / half); if (i !== idx && cur.length) { segs.push({ pts: cur, front: (idx + which) % 2 === 0, c: which }); cur = [cur[cur.length - 1]]; idx = i; } cur.push(q.p); } if (cur.length > 1) segs.push({ pts: cur, front: (idx + which) % 2 === 0, c: which }); };
  split(A, 0); split(B, 1);
  for (const pass of [false, true]) for (const g of segs) if (g.front === pass) {
    if (th.edge) P.line(g.pts, { tool: 'fineliner', color: th.edge, nib: (th.width ?? 0.8) + 0.32, jitter: 0, tremor: 0.15 });
    P.line(g.pts, { tool: th.tool, color: g.c ? th.c2 : th.c1, nib: th.width ?? 0.8, blunt: true, pressure: th.pressure ?? 0.95, jitter: 0, tremor: 0.15, profile: 'even' });
  }
}

function thread(P, pts, th) {
  if (th.edge) P.line(pts, { tool: 'fineliner', color: th.edge, nib: (th.width ?? 0.6) + 0.3, jitter: 0, tremor: 0.2 });
  P.line(pts, { tool: th.tool, color: th.c1, nib: th.width ?? 0.6, blunt: true, pressure: th.pressure ?? 0.95, jitter: 0, tremor: 0.2, profile: 'even' });
}

function arrowhead(P, tip, from, th, size = 4.2) {
  const d = sub(tip, from), l = len(d) || 1, u = [d[0] / l, d[1] / l], n = [-u[1], u[0]], w = size * 0.46;
  const base = [tip[0] - u[0] * size, tip[1] - u[1] * size], notch = [tip[0] - u[0] * size * 0.72, tip[1] - u[1] * size * 0.72];
  const tri = [tip, [base[0] + n[0] * w, base[1] + n[1] * w], notch, [base[0] - n[0] * w, base[1] - n[1] * w]];
  P.fill([tri], th.head || th.c1, { tool: th.tool === 'fineliner' ? 'pencil' : th.tool, pressure: 1, passes: 3, blunt: true });
  if (th.headEdge) P.outline([tri], { color: th.headEdge, nib: 0.22 });
}

function slide(P, n, th) {
  const R = rng('slide:' + n.id), padX = 2.6, padY = 1.4;
  const g = [n.x - padX, n.y - padY, n.w + padX * 2, n.h + padY * 2];
  const glass = D.rrect(g[0], g[1], g[0] + g[2], g[1] + g[3], 1.2);
  const label = D.rrect(n.x + 0.4, n.y + 0.2, n.x + n.w - 0.4, n.y + n.h - 0.2, 0.9);
  P.fill([glass], th.glass, { tool: th.glassTool || 'pastelpencil', pressure: th.glassPressure ?? 0.35, passes: 1, angle: 20 });
  P.fill([label], th.frost, { tool: 'pastelpencil', pressure: 0.98, passes: 3, angle: 30 + R() * 20 });
  if (th.mark) { const m = D.rrect(n.x + 1.6, n.y + 1.6, n.x + 3.8, n.y + n.h - 1.6, 0.6); P.fill([m], th.mark, { tool: 'pencil', pressure: 0.95, passes: 2 }); }
  P.outline([glass], { color: th.glassEdge, nib: 0.24 });
  P.line([[g[0] + 1.6, g[1] + 0.55], [g[0] + g[2] - 4, g[1] + 0.55]], { tool: th.shineTool || 'gel', color: th.shine, nib: 0.35, jitter: 0, tremor: 0.1 });
  for (const l of n.lines) P.text(l.text, l.x + (th.mark ? 1.2 : 0), l.y, { size: th.size, color: th.text, align: 'center' });
}

function tagShape(r, seed) {
  const R = rng('tag:' + seed), pts = [], j = 0.35;
  const edge = (a, b, n) => { for (let i = 0; i < n; i++) { const t = i / n; pts.push([a[0] + (b[0] - a[0]) * t + (R() - 0.5) * j, a[1] + (b[1] - a[1]) * t + (R() - 0.5) * j]); } };
  const [x, y, w, h] = [r.x, r.y, r.w, r.h];
  edge([x, y], [x + w, y], 10); edge([x + w, y], [x + w, y + h], 4); edge([x + w, y + h], [x, y + h], 10); edge([x, y + h], [x, y], 4);
  return pts;
}

function tag(P, t, th) {
  const shape = tagShape(t, t.key);
  P.fill([shape.map(([x, y]) => [x + 0.7, y + 0.9])], th.tagShadow, { tool: 'pencil', pressure: 0.5, passes: 1 });
  P.fill([shape], th.tagFill, { tool: 'pastelpencil', pressure: 0.98, passes: 3, angle: 15 });
  if (th.tagEdge) P.outline([shape], { color: th.tagEdge, nib: 0.18 });
  t.lines.forEach((s, i) => P.text(s, t.x + t.w / 2, t.y + 1.35 + t.size * 0.92 + i * t.size * 1.22, { size: t.size, color: t.red ? th.tagRed : th.tagText, align: 'center' }));
}

const GOLD = { tool: 'pastelpencil', c1: '#e2b33f', c2: '#f6ecd2', edge: '#3a2a14', head: '#e2b33f', headEdge: '#3a2a14' };
const RED = { tool: 'pastelpencil', c1: '#c4453a', c2: '#ef9a8c', edge: '#3d1410', head: '#c4453a', headEdge: '#3d1410' };
const PLAIN = { tool: 'pastelpencil', c1: '#efe6d2', edge: '#2e2a26', head: '#efe6d2', headEdge: '#2e2a26' };

module.exports = { GOLD, RED, PLAIN, lengthOf, cut, at, resample, smoothPts, cord, thread, arrowhead, slide, tag };
