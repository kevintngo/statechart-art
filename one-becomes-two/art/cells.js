'use strict';
const path = require('path');
const fs = require('fs');
const M = require('./media');
const B = require('./bio');
const { D } = M;
const { rng } = require('../../tools/kit/util');

const OUT = path.join(__dirname, '..', 'out', 'cells');
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const PPM = Number(opt('ppm', 9)), FRAMES = Number(opt('frames', 3)), ONLY = opt('only', '').split(',').filter(Boolean);

const C = 40;
const GOLD = { fill: '#f3d58c', light: '#fbe9b8', line: '#6b4a1c', glow: '#f6d58a', shade: '#b08a3a' };
const MITO = { mito: '#d9727a', mitoLine: '#7a2f36', line: '#6b4a1c', tool: 'pencil' };
const NUC = { fill: '#efc2b6', light: '#f8ddd4', line: '#7a2f36', thread: '#6b3a5a' };
const CHROM = [['#7a4a8a', '#a87ab8'], ['#3f7f73', '#7ab8a8'], ['#4f7fa8', '#9fc3e0']];
const RED = '#c4453a', DARK = '#3d1410', FIBRE = '#8a6420';

function field(P) {
  P.fill([D.ell(C, C, 40, 40)], '#f8efd9', { tool: 'pastelpencil', pressure: 0.3, passes: 1, angle: 25 });
  const R = rng('nb');
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * B.TAU + R() * 0.4, rr = 35 + R() * 3, x = C + Math.cos(a) * rr, y = C + Math.sin(a) * rr, r = 8 + R() * 3;
    const b = B.blob(x, y, r, r * 0.9, 'nb' + i, { wob: 0.1, rot: a });
    P.fill([b], ['#f2c3c6', '#efc7b8', '#ecbfcf'][i % 3], { tool: 'pencil', pressure: 0.35, passes: 2 });
    P.fill([B.blob(x - Math.cos(a) * r * 0.2, y - Math.sin(a) * r * 0.2, r * 0.32, r * 0.3, 'nbn' + i)], '#a58ab5', { tool: 'pencil', pressure: 0.42, passes: 2 });
    P.outline([b], { color: '#c09098', nib: 0.26 });
  }
}

function body(P, cx, cy, rx, ry, seed, q = {}) {
  const b = q.shape || B.blob(cx, cy, rx, ry, seed, { wob: q.wob ?? 0.05, n: 12, rot: q.rot || 0 });
  if (q.glow !== false) B.glow(P, cx, cy, rx * 1.3, GOLD.glow, { pressure: 0.12, steps: 3, ry: ry * 1.3 });
  P.fill([b], q.fill || GOLD.fill, { tool: 'pencil', pressure: 0.82, passes: 3 });
  P.fill([B.blob(cx - rx * 0.3, cy - ry * 0.32, rx * 0.5, ry * 0.4, seed + 'l')], GOLD.light, { tool: 'pencil', pressure: 0.5, passes: 1, clip: [b] });
  P.hatch([B.blob(cx + rx * 0.3, cy + ry * 0.38, rx * 0.75, ry * 0.5, seed + 's')], GOLD.shade, { angle: 35, pitch: 0.9, nib: 0.13, clip: [b] });
  const R = rng('mito:' + seed);
  for (let i = 0; i < (q.mito ?? 4); i++) { const a = R() * B.TAU, rr = 0.68 + R() * 0.12; B.mito(P, cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr, Math.min(rx, ry) * 0.28, Math.min(rx, ry) * 0.11, a + Math.PI / 2, MITO, seed + 'm' + i); }
  return b;
}
const edge = (P, b, nib = 0.62) => P.outline([b], { color: GOLD.line, nib });

function nucleus(P, cx, cy, r, seed, inside) {
  const n = B.blob(cx, cy, r, r * 0.94, seed + 'n', { wob: 0.06 });
  P.fill([n], NUC.fill, { tool: 'pencil', pressure: 0.78, passes: 2 });
  P.fill([B.blob(cx - r * 0.28, cy - r * 0.28, r * 0.5, r * 0.42, seed + 'nh')], NUC.light, { tool: 'pencil', pressure: 0.45, passes: 1, clip: [n] });
  if (inside) inside(n);
  P.outline([n], { color: NUC.line, nib: 0.42 });
  return n;
}

function threads(P, cx, cy, r, seed, n, color, q = {}) {
  const R = rng('th:' + seed);
  for (let i = 0; i < n; i++) P.line(B.squiggle(R, cx, cy, r * 0.72, r * 0.68, q.steps ?? 12, r * (q.len ?? 0.16)), { tool: 'pencil', color: Array.isArray(color) ? color[i % color.length] : color, pressure: 0.92, tremor: 0.5 });
}

function doubled(P, cx, cy, r, seed, n, cols, off = 0.6) {
  const R = rng('db:' + seed), out = [];
  for (let i = 0; i < n; i++) {
    const pts = B.squiggle(R, cx, cy, r * 0.66, r * 0.6, 10, r * 0.17);
    P.line(pts, { tool: 'gel', color: cols[0], nib: 0.42, tremor: 0.4 });
    P.line(pts.map(([x, y]) => [x + off, y + off]), { tool: 'gel', color: cols[1], nib: 0.42, tremor: 0.4 });
    out.push(pts);
  }
  return out;
}

function damage(P, x, y, s = 1) {
  B.glow(P, x, y, 3.4 * s, RED, { pressure: 0.24, steps: 2 });
  for (const [a, b] of [[[x - 1.5 * s, y - 1.5 * s], [x + 1.5 * s, y + 1.5 * s]], [[x + 1.5 * s, y - 1.5 * s], [x - 1.5 * s, y + 1.5 * s]]]) {
    P.line([a, b], { tool: 'fineliner', color: DARK, nib: 0.95 * s });
    P.line([a, b], { tool: 'gel', color: RED, nib: 0.55 * s });
  }
}

function p53(P, x, y, s, broken) {
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy], i) => {
    const c = [x + sx * 1.3 * s, y + sy * 1.1 * s], b = B.blob(c[0], c[1], 1.3 * s, 1 * s, `p53${i}${x}`, { wob: 0.14, rot: sx * sy * 0.5 });
    P.fill([b], broken ? '#a3aaa6' : i % 2 ? '#3f7f73' : '#5a9a8a', { tool: 'pencil', pressure: 0.95, passes: 3 });
    P.outline([b], { color: broken ? '#4a504d' : '#14302a', nib: 0.26 });
  });
  if (broken) { P.line([[x - 2.8 * s, y + 2.4 * s], [x + 2.8 * s, y - 2.4 * s]], { tool: 'fineliner', color: DARK, nib: 0.7 }); P.line([[x - 2.8 * s, y + 2.4 * s], [x + 2.8 * s, y - 2.4 * s]], { tool: 'gel', color: RED, nib: 0.4 }); }
}

function rings(P, x, y) {
  for (const dy of [-1.5, 1.5]) { const r = D.ell(x, y + dy, 2.7, 1.05); P.fill([r], '#c9b5e6', { tool: 'pencil', pressure: 0.95, passes: 2 }); P.outline([r], { color: '#4a2f55', nib: 0.22 }); }
}

function glucose(P, x, y, r, a) {
  const ring = []; for (let i = 0; i < 6; i++) { const t = a + (i / 6) * B.TAU; ring.push([x + Math.cos(t) * r, y + Math.sin(t) * r]); }
  P.fill([ring], '#f4ecd4', { tool: 'pencil', pressure: 0.5, passes: 1 });
  P.outline([ring], { color: '#4a3b33', nib: 0.24 });
  for (const k of [0, 2, 4]) { const t = a + (k / 6) * B.TAU, p = [x + Math.cos(t) * r, y + Math.sin(t) * r], q = [x + Math.cos(t) * r * 1.6, y + Math.sin(t) * r * 1.6]; P.line([p, q], { tool: 'fineliner', color: '#4a3b33', nib: 0.2 }); }
}

function X(P, x, y, i, q = {}) {
  return B.chromosome(P, x, y, { len: q.len ?? 8, width: q.width ?? 2.7, angle: q.angle ?? 0, colors: CHROM[i % 3], bands: '#f2e6ee', line: '#241826', nib: 0.26, tool: 'pencil', seed: 'x' + i + (q.seed || ''), spread: q.spread ?? 0.3 });
}

function V(P, x, y, i, dir, l = 4.6) {
  const back = dir < 0 ? 0 : Math.PI;
  for (const d of [-0.32, 0.32]) { const arm = B.chromatidArm([x, y], back + d, l, 1.25); P.fill([arm], CHROM[i % 3][1], { tool: 'pencil', pressure: 0.98, passes: 2 }); P.fill([arm], CHROM[i % 3][0], { tool: 'pencil', pressure: 0.5, passes: 1 }); P.outline([arm], { color: '#241826', nib: 0.24 }); }
  P.dot(x, y, 0.75, '#241826', { tool: 'pencil' });
}

function poles(P, cx, cy, w, k = 0) {
  for (const [x, from] of [[cx - w, -0.8], [cx + w, Math.PI - 0.8]]) B.aster(P, x, cy, { r0: 1.2, r1: 7 + k * 0.2, rays: 18, from, span: 1.6, c1: FIBRE, c2: '#b08a3a', core: '#5a3d16', tool: 'pencil', nib: 0.2 });
}
const fibre = (P, a, b, bend = 0) => P.curve([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + bend], b], { tool: 'pencil', color: FIBRE, pressure: 0.85, tremor: 0.3 });

function marks(P, cx, cy, cols, hurt) {
  cols.forEach((c, i) => { const x = cx - (cols.length - 1) * 1.6 + i * 3.2, y = cy + (i % 2 ? 0.8 : -0.8); P.line([[x, y - 1.6], [x + 0.3, y + 1.6]], { tool: 'fineliner', color: '#241826', nib: 1.2 }); P.line([[x, y - 1.6], [x + 0.3, y + 1.6]], { tool: 'gel', color: CHROM[c][1], nib: 0.8 }); });
  if (hurt) damage(P, cx + 0.5, cy + 2.8, 0.55);
}

function daughters(P, k, left, right, hurt) {
  const out = [];
  for (const [x, cols, seed] of [[C - 13.5, left, 'dl'], [C + 13.5, right, 'dr']]) {
    const b = body(P, x, C + 0.5, 11.5, 11, seed, { mito: 3 });
    nucleus(P, x + 0.5, C + 1, 5.6, seed, () => marks(P, x + 0.5, C + 0.6, cols, hurt));
    out.push(b);
  }
  for (const b of out) edge(P, b, 0.58);
}

function lobes(cx, cy, r, gap) { return [D.ell(cx - gap / 2, cy, r, r * 0.96), D.ell(cx + gap / 2, cy, r, r * 0.96)]; }

const STATES = {
  g1: (P, k) => {
    const R = rng('glu');
    for (let i = 0; i < 5; i++) { const a = -2.5 + i * 0.6, rr = 28.5 - k * 0.8; glucose(P, C + Math.cos(a) * rr, C + Math.sin(a) * rr, 1.6, R() * 3); }
    const b = body(P, C, C + 1, 18, 16, 'g1');
    nucleus(P, C + 1, C + 2, 7, 'g1', () => threads(P, C + 1, C + 2, 7, 'g1', 7, NUC.thread));
    edge(P, b);
  },
  g0: (P) => {
    const b = body(P, C, C, 14, 12.5, 'g0', { fill: '#efdaa6', mito: 3 });
    nucleus(P, C, C + 0.5, 5.2, 'g0', () => threads(P, C, C + 0.5, 5.2, 'g0', 4, '#4a2a40', { len: 0.12, steps: 8 }));
    edge(P, b, 0.5);
  },
  'held-p53': (P) => {
    const b = body(P, C, C + 1, 18, 16, 'g1');
    nucleus(P, C + 1, C + 2, 7, 'g1', () => { threads(P, C + 1, C + 2, 7, 'g1', 7, NUC.thread); damage(P, C + 2.5, C + 0.5, 0.9); });
    p53(P, C + 8.6, C - 4.6, 1);
    p53(P, C - 5.5, C + 8.2, 1);
    edge(P, b);
  },
  'p53-broken': (P) => {
    const b = body(P, C, C + 1, 18, 16, 'g1');
    nucleus(P, C + 1, C + 2, 7, 'g1', () => { threads(P, C + 1, C + 2, 7, 'g1', 7, NUC.thread); damage(P, C + 2.5, C + 0.5, 1); });
    p53(P, C + 8.6, C - 4.6, 1, true);
    edge(P, b);
  },
  s: (P) => {
    const b = body(P, C, C + 1, 19, 17, 's');
    nucleus(P, C + 1, C + 2, 9.6, 's', () => doubled(P, C + 1, C + 2, 9.6, 's', 6, ['#c99a3a', '#4f7fa8']));
    edge(P, b);
  },
  's-damaged': (P) => {
    const b = body(P, C, C + 1, 19, 17, 's');
    nucleus(P, C + 1, C + 2, 9.6, 's', () => { const lines = doubled(P, C + 1, C + 2, 9.6, 's', 6, ['#c99a3a', '#4f7fa8']); const p = lines[1][Math.floor(lines[1].length / 2)]; damage(P, p[0], p[1], 0.75); damage(P, p[0] + 2.2, p[1] + 2.2, 0.75); });
    edge(P, b);
  },
  g2: (P) => {
    const b = body(P, C, C + 1, 20, 18, 'g2', { mito: 5 });
    nucleus(P, C + 1, C + 2, 8.6, 'g2', () => CHROM.forEach((c, i) => doubled(P, C + 1, C + 2, 8.6, 'g2' + i, 2, c, 0.65)));
    edge(P, b);
  },
  'held-g2': (P) => {
    const b = body(P, C, C + 1, 20, 18, 'g2', { mito: 5 });
    nucleus(P, C + 1, C + 2, 8.6, 'g2', () => { CHROM.forEach((c, i) => doubled(P, C + 1, C + 2, 8.6, 'g2' + i, 2, c, 0.65)); damage(P, C + 3, C + 1, 0.9); });
    rings(P, C + 3, C + 1);
    edge(P, b);
  },
  apoptosis: (P, k) => {
    const pieces = [[34, 36, 6.5], [45, 33, 5], [44, 45, 6], [33, 48, 4.6], [52, 42, 4], [39, 55, 3.6], [27, 40, 3.4], [50, 52, 3]];
    pieces.forEach(([x, y, r], i) => {
      const b = B.blob(x + (i % 2 ? k * 0.25 : -k * 0.25), y, r, r * 0.92, 'ap' + i, { wob: 0.1 });
      P.fill([b], i % 3 === 2 ? '#efc2b6' : GOLD.fill, { tool: 'pencil', pressure: 0.85, passes: 3 });
      P.fill([B.blob(x - r * 0.25, y - r * 0.25, r * 0.45, r * 0.35, 'aph' + i)], GOLD.light, { tool: 'pencil', pressure: 0.5, passes: 1, clip: [b] });
      if (i % 2 === 0) P.dot(x + r * 0.2, y + r * 0.15, r * 0.26, '#a3352b', { tool: 'pencil' });
      P.outline([b], { color: GOLD.line, nib: 0.42 });
    });
    const mac = B.blob(66 - k * 0.4, 58, 13, 10, 'mac', { wob: 0.2, n: 14, rot: -0.5 });
    P.fill([mac], '#a796c2', { tool: 'pencil', pressure: 0.7, passes: 2 });
    P.fill([B.blob(64, 55, 6, 4, 'macn')], '#6b4a8a', { tool: 'pencil', pressure: 0.8, passes: 2 });
    P.outline([mac], { color: '#3d2f55', nib: 0.42 });
  },
  prophase: (P) => {
    const b = body(P, C, C, 19, 18.5, 'pro', { mito: 5 });
    nucleus(P, C, C, 10.5, 'pro', () => { X(P, C - 4.5, C - 2.5, 0, { angle: 0.5 }); X(P, C + 4, C - 3, 1, { angle: -0.7 }); X(P, C + 0.5, C + 4.5, 2, { angle: 1.4 }); });
    edge(P, b);
  },
  prometaphase: (P) => {
    const b = body(P, C, C, 20, 18.5, 'prm', { mito: 4 });
    const R = rng('frag');
    for (let i = 0; i < 9; i++) { const a = R() * B.TAU, r = 11 + R() * 1.8, pts = []; for (let j = 0; j <= 6; j++) { const t = a + (j / 6) * 0.45; pts.push([C + Math.cos(t) * r, C + Math.sin(t) * r * 0.9]); } P.line(pts, { tool: 'pencil', color: NUC.line, pressure: 0.85, blunt: true }); }
    poles(P, C, C, 15.5);
    X(P, C - 3.5, C - 4, 0, { angle: 0.9 }); X(P, C + 4, C + 1, 1, { angle: -0.5 }); X(P, C - 2, C + 5.5, 2, { angle: 2.2 });
    edge(P, b);
  },
  'caught-wait': (P, k) => caughtScene(P, k, false),
  'caught-broken': (P, k) => caughtScene(P, k, true),
  metaphase: (P, k) => {
    const b = body(P, C, C, 21, 18.5, 'met', { mito: 4 });
    poles(P, C, C, 16.5);
    [C - 8, C, C + 8].forEach((y, i) => { const j = (k - 1) * 0.2 * (i % 2 ? 1 : -1); fibre(P, [C - 16.5, C], [C - 1.2, y + j], (y - C) * 0.2); fibre(P, [C + 16.5, C], [C + 1.2, y + j], (y - C) * 0.2); X(P, C, y + j, i, { angle: 0, len: 6.8 }); });
    edge(P, b);
  },
  anaphase: (P, k) => {
    const b = body(P, C, C, 23.5, 17, 'ana', { mito: 4 });
    poles(P, C, C, 19.5);
    const d = 7 + k * 0.9;
    [C - 5.5, C, C + 5.5].forEach((y, i) => { fibre(P, [C - 19.5, C], [C - d, y]); fibre(P, [C + 19.5, C], [C + d, y]); V(P, C - d, y, i, -1); V(P, C + d, y, i, 1); });
    for (let i = 0; i < 4; i++) P.line([[C - 4, C - 4.5 + i * 3], [C + 4, C - 4.5 + i * 3]], { tool: 'pencil', color: '#b08a3a', pressure: 0.5, tremor: 0.4 });
    edge(P, b);
  },
  'too-soon': (P, k) => {
    const b = body(P, C, C, 23.5, 17, 'ana', { mito: 4 });
    poles(P, C, C, 19.5);
    const d = 7 + k * 0.9;
    [C - 5.5, C].forEach((y, i) => { fibre(P, [C - 19.5, C], [C - d, y]); fibre(P, [C + 19.5, C], [C + d, y]); V(P, C - d, y, i, -1); V(P, C + d, y, i, 1); });
    fibre(P, [C + 19.5, C], [C + d - 1.5, C + 6]);
    B.glow(P, C + d - 2, C + 6, 4, RED, { pressure: 0.22, steps: 2 });
    X(P, C + d - 2, C + 6, 2, { angle: 0.3 });
    edge(P, b);
  },
  telophase: (P) => {
    const shape = [...lobes(C, C, 14, 18), [[C - 6, C - 9.5], [C + 6, C - 9.5], [C + 6, C + 9.5], [C - 6, C + 9.5]]];
    B.glow(P, C, C, 30, GOLD.glow, { pressure: 0.12, steps: 3, ry: 20 });
    P.fill(shape, GOLD.fill, { tool: 'pencil', pressure: 0.82, passes: 3 });
    P.hatch([D.ell(C - 6, C + 7, 13, 6), D.ell(C + 12, C + 7, 13, 6)], GOLD.shade, { angle: 35, pitch: 0.9, nib: 0.13, clip: shape });
    for (const x of [C - 13, C + 13]) nucleus(P, x, C, 5.6, 'tel' + x, () => threads(P, x, C, 5.6, 'tel' + x, 5, CHROM.map((c) => c[0])));
    for (let i = 0; i < 4; i++) P.line([[C - 5, C - 3 + i * 2], [C + 5, C - 3 + i * 2]], { tool: 'pencil', color: '#b08a3a', pressure: 0.45, tremor: 0.4 });
    P.outline(shape, { color: GOLD.line, nib: 0.62 });
  },
  cytokinesis: (P, k) => {
    const gap = 21 + k * 0.4, r = 12.6, shape = lobes(C, C, r, gap), waist = Math.sqrt(Math.max(0, r * r - (gap / 2) ** 2)) * 0.96;
    B.glow(P, C, C, 30, GOLD.glow, { pressure: 0.12, steps: 3, ry: 18 });
    P.fill(shape, GOLD.fill, { tool: 'pencil', pressure: 0.82, passes: 3 });
    for (const x of [C - gap / 2, C + gap / 2]) nucleus(P, x, C, 5.4, 'cyt' + Math.round(x), () => threads(P, x, C, 5.4, 'cyt' + Math.round(x), 5, CHROM.map((c) => c[0])));
    P.outline(shape, { color: GOLD.line, nib: 0.62 });
    for (const dx of [-1, 0, 1]) P.line([[C + dx - 0.5, C - waist], [C + dx + 0.5, C + waist]], { tool: 'pencil', color: '#933323', pressure: 1, blunt: true });
  },
  healthy: (P, k) => daughters(P, k, [0, 1, 2], [0, 1, 2], false),
  mutation: (P, k) => daughters(P, k, [0, 1, 2], [0, 1, 2], true),
  uneven: (P, k) => daughters(P, k, [0, 1], [0, 1, 2, 2], false),
};

function caughtScene(P, k, broken) {
  const b = body(P, C, C, 20.5, 18.5, 'cgt', { mito: 4 });
  poles(P, C, C, 16);
  const A = [C - 2.5, C - 5.5], Bp = [C + 2, C + 1], Cp = [C + 5.5, C + 7];
  fibre(P, [C - 16, C], [A[0] - 1.2, A[1]], -2); fibre(P, [C + 16, C], [A[0] + 1.2, A[1]], -2);
  fibre(P, [C - 16, C], [Bp[0] - 1.2, Bp[1]]); fibre(P, [C + 16, C], [Bp[0] + 1.2, Bp[1]]);
  fibre(P, [C + 16, C], [Cp[0] + 1.2, Cp[1]], 2);
  X(P, A[0], A[1], 0, { angle: 0.1 }); X(P, Bp[0], Bp[1], 1, { angle: -0.15 }); X(P, Cp[0], Cp[1], 2, { angle: 0.25 });
  const loose = [Cp[0] - 1.4, Cp[1]];
  if (broken) { P.dot(loose[0], loose[1], 1, '#8a8f8c', { tool: 'pencil' }); P.line([[loose[0] - 1.6, loose[1] + 1.6], [loose[0] + 1.6, loose[1] - 1.6]], { tool: 'gel', color: RED, nib: 0.4 }); }
  else { B.glow(P, loose[0], loose[1], 3.4 + k * 0.3, RED, { pressure: 0.3, steps: 3 }); P.dot(loose[0], loose[1], 1, RED, { tool: 'pencil' }); }
  edge(P, b);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [slug, draw] of Object.entries(STATES)) {
    if (ONLY.length && !ONLY.includes(slug)) continue;
    for (let k = 0; k < FRAMES; k++) {
      const P = M.sheet({ id: 'cell-' + slug, w: 64, h: 64, ppm: PPM, paper: 'hotpress', seed: 'cellfield', inkSeed: `${slug}-${k}`, left: 8, top: 8 });
      field(P);
      draw(P, k);
      await P.save(path.join(OUT, `${slug}-${k}.png`));
    }
    console.log(slug);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
