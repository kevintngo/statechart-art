'use strict';
const M = require('./media');
const B = require('./bio');
const Mk = require('./marks');
const { D } = M;
const { rng } = require('../../tools/kit/util');
const { C } = B;
const { captioner } = require('./caption');

const INK = '#1d1a1e';
const BASE = { black: '#151517', navy: '#192544', teal: '#0f2e32', kraft: '#b28d63', cream: '#f0e7d0', hotpress: '#f5f1e7', graph: '#f1f5f1', cartridge: '#f7f5ef' };
const baseOf = (paper) => (typeof paper === 'string' ? BASE[paper] : paper.base);

const SLIDE_DARK = { glass: '#cfe3ea', glassTool: 'pastelpencil', glassPressure: 0.28, frost: '#f4efe4', glassEdge: '#dceaf0', shine: '#ffffff', text: INK };
const SLIDE_LIGHT = { glass: '#b9cfd9', glassTool: 'pencil', glassPressure: 0.45, frost: '#fbf8f1', glassEdge: '#4f626b', shine: '#ffffff', text: INK };
const TAG_DARK = { tagFill: '#f3ead6', tagShadow: '#0b0a0b', tagEdge: null, tagText: INK, tagRed: '#8f2a20' };
const TAG_LIGHT = { tagFill: '#fbf6ea', tagShadow: '#7d7266', tagEdge: '#6f655a', tagText: INK, tagRed: '#8f2a20' };

function look(id, paper, dark, more = {}) {
  return { id, paper, dark, slide: dark ? SLIDE_DARK : SLIDE_LIGHT, tag: dark ? TAG_DARK : TAG_LIGHT, ...more };
}

function seam(P, s, prev, cur) {
  const R = rng('seam:' + cur.id), top = s.top, pts = [];
  for (let x = -2; x <= P.w + 2; x += 1.5) pts.push([x, top + 1.6 + 1.3 * Math.sin(x * 0.11 + R() * 0.4) + (R() - 0.5) * 1.1]);
  const band = [[-2, top - 1], [P.w + 2, top - 1], ...pts.slice().reverse()];
  P.fill([band], baseOf(prev.paper), { tool: 'pastelpencil', pressure: 1, passes: 3 });
  P.line(pts.map(([x, y]) => [x, y + 0.6]), { tool: 'pencil', color: cur.dark ? '#000000' : '#5b5146', pressure: 0.5, jitter: 0, tremor: 0.2 });
}

function vignette(P, s, color, q = {}) {
  const t = s.top, h = s.h, w = P.w, steps = q.steps ?? 4, depth = q.depth ?? 22;
  for (let k = 0; k < steps; k++) {
    const d = depth * (1 - k / steps), outer = [[-4, t - 4], [w + 4, t - 4], [w + 4, t + h + 4], [-4, t + h + 4]], inner = [[d, t + d * 0.6], [w - d, t + d * 0.6], [w - d, t + h - d * 0.6], [d, t + h - d * 0.6]];
    P.fill([[outer, inner]], color, { tool: 'pastelpencil', pressure: (q.pressure ?? 0.16) + k * 0.05, passes: 1, angle: 25 + k * 40 });
  }
}

function header(P, y, big, small, q = {}) {
  P.text(big, q.x ?? 10, y, { size: q.size ?? 9.5, color: q.color || INK });
  if (small) P.text(small, q.x ?? 10, y + (q.size ?? 9.5) * 0.9, { size: q.small ?? 5, color: q.soft || q.color || INK });
}

const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

function title(P, s, wall) {
  const rect = { x0: -8, y0: 152, x1: 188, y1: 264 }, sc = wall.startCell;
  const sites = [sc, ...B.scatter('tissue', rect, 190, 10.5, (p) => B.len(B.sub(p, sc)) < 17)];
  const cells = B.voronoi(rect, sites);
  const pinks = ['#f2b9c2', '#ebb0b8', '#f2c3a0', '#efc4bd', '#e9b9c9', '#f4cdb3'];
  for (const c of cells) {
    const hero = c.site === sc, fade = Math.max(0, Math.min(1, (c.site[1] - 152) / 34));
    const poly = B.rounded(B.inset(c.poly, hero ? 0.6 : 0.85), 2), k = hash(c.site.join());
    if (hero) {
      B.glow(P, sc[0], sc[1], 22, '#f6d58a', { pressure: 0.16, steps: 4 });
      P.fill([poly], '#f3d58c', { tool: 'pencil', pressure: 0.8, passes: 3 });
      P.fill([B.blob(sc[0] - 2, sc[1] - 2, 8, 7, 'heroL')], '#fbe9b8', { tool: 'pencil', pressure: 0.5, passes: 1, clip: [poly] });
      B.nucleus(P, sc[0] + 1, sc[1] + 1, 4.6, 4.2, 'heroN', { nucleus: '#c4453a', nucleusLight: '#e0675c', chromatin: '#5a1a1a', nucleolus: '#3d1410', envelope: '#3d1410', tool: 'pencil' }, { threads: 5 });
      P.outline([poly], { color: '#6b4a1c', nib: 0.55 });
      continue;
    }
    P.fill([poly], pinks[k % pinks.length], { tool: 'pencil', pressure: 0.32 + 0.42 * fade, passes: 2, angle: 20 + (k % 50) });
    const R = rng('t' + k), nx = c.site[0] + (R() - 0.5) * 2.2, ny = c.site[1] + (R() - 0.5) * 2.2, nr = 1.9 + R() * 0.9;
    const nuc = B.blob(nx, ny, nr * 1.15, nr, 'tn' + k, { wob: 0.12, rot: R() * 3 });
    P.fill([nuc], k % 3 ? '#8a6aa0' : '#6b4a7a', { tool: 'pencil', pressure: 0.45 + 0.45 * fade, passes: 2 });
    if (fade > 0.3) P.stipple([nuc], '#3d2f45', { nib: 0.2, density: 1.4, size: 0.8 });
    P.outline([poly], { color: fade > 0.4 ? '#8a5468' : '#b98a98', nib: 0.26 });
  }
}

const CREDITS = [
  [['Charted with the /statechart skill by '], ['@poteto', 'https://x.com/poteto'], ['.']],
  [['Modelled in TLA+, checked by '], ['TLC', 'https://github.com/tlaplus/tlaplus'], [' and laid out by '], ['pele', 'https://pele.run'], ['.']],
  [['Drawn in JavaScript with simulated pencil, pastel and gel pen.']],
  [['Lettering in Kevin Sans, traced from A. V. Hershey\u2019s 1967 fonts.']],
  [['The code and drawings are on '], ['GitHub', 'https://github.com/kevintngo/statechart-art'], [', under the '], ['MIT license', 'https://github.com/kevintngo/statechart-art/blob/main/LICENSE'], ['.']],
];

function titleFront(P, s, wall) {
  const ink2 = '#3d3530', credits = [], size = 4;
  P.text('One becomes two', 10, 34, { size: 14.6, color: INK });
  P.text('The life of one cell, drawn as a statechart.', 10.5, 46.5, { size: 5.4, color: ink2 });
  CREDITS.forEach((parts, i) => {
    const y = 59 + i * 6.2, x0 = 10.5;
    let x = x0;
    for (const [t, href] of parts) {
      const w = M.measure(t, size, 'sans');
      P.text(t, x, y, { size, color: href ? INK : ink2, face: 'sans' });
      x += w;
    }
    credits.push({ x: x0, y, size, w: x - x0, parts: parts.map(([t, href]) => (href ? { t, href } : { t })) });
  });
  const lines = ['Each glass slide is a state a cell can be in.', 'Each thread is a step it can take.', 'TLC, a model checker, tried every one:', '61 states and 77 steps.'];
  lines.forEach((l, i) => P.text(l, 10.5, 98 + i * 6.6, { size: 4.5, color: ink2 }));
  const key = [[Mk.GOLD, 'a healthy cell'], [Mk.RED, 'what TLC found when a check breaks'], [Mk.PLAIN, 'every other step']];
  key.forEach(([th, t], i) => {
    const y = 131 + i * 7.2, pts = [[11, y], [31, y]];
    if (th === Mk.PLAIN) Mk.thread(P, pts, th); else Mk.cord(P, pts, th);
    P.text(t, 37, y + 1.6, { size: 4.3, color: ink2 });
  });
  const words = ['Step through', 'the chart'], ts = 4.4, tw = Math.max(...words.map((w) => M.measure(w, ts))), tag = { x: 172 - (tw + 17), y: 103, w: tw + 17, h: 16, lines: [], key: 'step' };
  Mk.tag(P, tag, TAG_LIGHT);
  const cy = tag.y + tag.h / 2, tri = [[tag.x + 5, cy - 2.7], [tag.x + 5, cy + 2.7], [tag.x + 9.8, cy]];
  P.fill([tri], '#e2b33f', { tool: 'pencil', pressure: 1, passes: 3 });
  P.outline([tri], { color: '#3a2a14', nib: 0.3 });
  words.forEach((w, i) => P.text(w, tag.x + 12.5, cy - 0.6 + i * 5.6 - 1.9, { size: ts, color: INK }));
  return { credits, step: { x: tag.x, y: tag.y, w: tag.w, h: tag.h } };
}

const G1PAL = { cyto: '#f6e2c6', shade: '#e8c4a0', ribo: '#b98c6a', mito: '#d9727a', mitoLine: '#7a2f36', line: '#4a3b33', er: '#c99a3a', vesicle: '#a9cfe0', nucleus: '#c6b6de', nucleusLight: '#e0d6ee', chromatin: '#6b4a7a', nucleolus: '#4a2f55', envelope: '#3d2f45', tool: 'pencil' };
const PASTEL = { cream: '#f3e9d2', gold: '#e2b33f', coral: '#e0675c', rose: '#e88d8f', blush: '#f2b9c2', sky: '#9fd0e3', mint: '#a8dcc5', lilac: '#c9b5e6', butter: '#f3d78f', sage: '#a7c48f' };
const BASES = [PASTEL.coral, PASTEL.sky, PASTEL.gold, PASTEL.mint];

function glucose(P, x, y, r, a) {
  const ring = []; for (let i = 0; i < 6; i++) { const t = a + (i / 6) * B.TAU; ring.push([x + Math.cos(t) * r, y + Math.sin(t) * r]); }
  P.fill([ring], '#f4ecd4', { tool: 'pencil', pressure: 0.5, passes: 1 });
  P.outline([ring], { color: '#4a3b33', nib: 0.26 });
  for (const k of [0, 2, 4]) { const t = a + (k / 6) * B.TAU, p = [x + Math.cos(t) * r, y + Math.sin(t) * r], q = [x + Math.cos(t) * r * 1.7, y + Math.sin(t) * r * 1.7]; P.line([p, q], { tool: 'fineliner', color: '#4a3b33', nib: 0.22 }); P.dot(q[0], q[1], 0.45, k ? '#c4453a' : '#4a3b33', { tool: 'pencil' }); }
}
function specks(P, rect, n, colors, seed, q = {}) {
  const R = rng('sp:' + seed);
  for (let i = 0; i < n; i++) { const x = rect.x0 + R() * (rect.x1 - rect.x0), y = rect.y0 + R() * (rect.y1 - rect.y0); P.dot(x, y, (q.r ?? 0.5) * (0.5 + R()), colors[i % colors.length], { tool: q.tool || 'pastelpencil', pressure: q.pressure ?? 0.7 }); }
}

function growing(P, s, cap) {
  const y = s.top;
  P.stipple([[[0, y + 78], [180, y + 78], [180, y + 126], [0, y + 126]]], '#8ea27e', { nib: 0.22, density: 0.3, size: 0.9 });
  B.glow(P, 142, y + 41, 38, '#e3e8d2', { ry: 30, pressure: 0.14, steps: 3 });
  B.cell(P, { cx: 142, cy: y + 41, rx: 30, ry: 23.5, seed: 'g1cell', pal: G1PAL, mito: 8, vesicles: 12, ribo: 0.5 });
  for (let k = 0; k < 4; k++) { const pts = []; for (let i = 0; i <= 12; i++) { const t = -0.5 + i / 12; pts.push([157 + t * (11 - k * 1.8), y + 53.5 - k * 2 + t * t * 7]); } const g = B.tube(pts, 0.75); P.fill([g], '#e9a07a', { tool: 'pencil', pressure: 0.95, passes: 2 }); P.outline([g], { color: '#6a3a2a', nib: 0.2 }); }
  P.hatch([B.blob(150, y + 50, 24, 15, 'g1sh')], '#8a6a52', { angle: 35, pitch: 0.9, nib: 0.14, clip: [B.blob(142, y + 41, 29, 22.5, 'g1cell', { wob: 0.05, n: 12 })] });
  const R = rng('glucose');
  const spots = B.scatter('glu', { x0: 12, y0: y + 40, x1: 76, y1: y + 60 }, 9, 9);
  for (const p of spots) glucose(P, p[0], p[1], 2.1 + R() * 0.5, R() * 3);
  cap.avoid(110, y + 14, 175, y + 68); cap.avoid(8, y + 34, 80, y + 63);
  cap(['sugar comes in,', 'and the cell grows'], 12, y + 68, { color: '#3d3830' });
}

function p53(P, cx, cy, sc) {
  const lobes = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  lobes.forEach(([sx, sy], i) => {
    const c = [cx + sx * 5.2 * sc, cy + sy * 4.3 * sc], body = B.blob(c[0], c[1], 4.8 * sc, 3.7 * sc, 'p53' + i, { wob: 0.14, rot: sx * sy * 0.5 });
    P.fill([body], i % 2 ? '#3f7f73' : '#5a9a8a', { tool: 'pastelpencil', pressure: 0.98, passes: 3 });
    for (let k = -1; k <= 1; k++) P.curve([[c[0] - 3.4 * sc, c[1] + k * 1.3 * sc], [c[0], c[1] + k * 1.3 * sc - 1.1 * sc], [c[0] + 3.4 * sc, c[1] + k * 1.3 * sc]], { tool: 'pastelpencil', color: '#b9e3d2', pressure: 0.7 });
    P.outline([body], { color: '#14302a', nib: 0.36 });
  });
}

function firstCheck(P, s, cap) {
  const y = (v) => s.top + v;
  for (const [a, w] of [[0.28, 16], [0.42, 12], [0.58, 18], [0.74, 10]]) B.rays(P, [-12, y(20)], [a], { len: 120, width: w, color: '#f3dca6', pressure: 0.32 });
  for (const a of [0.5, 0.58, 0.66]) { const tip = [63, y(56)], o = [-6, y(25)], d = [tip[0] - o[0], tip[1] - o[1]], L = Math.hypot(d[0], d[1]); const pts = [o, [o[0] + d[0] * 0.98, o[1] + d[1] * 0.98 + (a - 0.58) * 16]]; P.line(pts, { tool: 'gel', color: '#d9c8f0', nib: 0.5 }); void L; }
  B.helix(P, [-8, y(57)], [188, y(55)], { amp: 6.2, period: 26, c1: '#f6ecd2', c2: '#7a3e24', edge: '#2e1c10', edgeNib: 2.2, blunt: true, bases: [PASTEL.rose, PASTEL.sky, PASTEL.gold, PASTEL.sage], seed: 'fc', rungTool: 'pastelpencil', tool: 'pastelpencil', skip: (t) => Math.abs(t - 0.36) < 0.018 });
  B.glow(P, 63, y(56), 11, '#e0675c', { pressure: 0.2, steps: 3 });
  for (const [a, b] of [[[59.5, y(50.5)], [66.5, y(61.5)]], [[66.5, y(50.5)], [59.5, y(61.5)]]]) P.line([a, b], { tool: 'pastelpencil', color: '#b0302a', pressure: 1, blunt: true });
  p53(P, 143, y(55), 1.4);
  cap.avoid(-10, y(46), 190, y(66)); cap.avoid(122, y(40), 165, y(70));
  cap('sunlight can break the DNA', 8, y(74), { color: '#24180f' });
  cap.avoid(30, y(66), 110, y(80));
  cap('p53 holds the cell', 118, y(77), { color: '#24180f', size: 3.7 });
}

function copying(P, s, cap) {
  const y = (v) => s.top + v, fork = [132, y(38)], R = rng('nt');
  for (let i = 0; i < 70; i++) { const x = R() * 180, yy = y(4 + R() * 68), a = R() * 3; if (x < 52 && yy < y(26)) continue; P.line([[x, yy], [x + Math.cos(a) * 1.6, yy + Math.sin(a) * 1.6]], { tool: 'pastelpencil', color: BASES[i % 4], pressure: 0.75 }); }
  B.glow(P, fork[0], fork[1], 22, '#2a6468', { pressure: 0.26, steps: 4 });
  B.helix(P, [194, y(20)], fork, { amp: 5.4, period: 21, c1: PASTEL.cream, c2: PASTEL.gold, bases: BASES, seed: 'cp0', tool: 'pastelpencil', rungTool: 'pastelpencil', blunt: true, edge: '#06181a', edgeNib: 2.1 });
  B.helix(P, fork, [64, y(12)], { amp: 4.6, period: 18, c1: PASTEL.cream, c2: PASTEL.sky, bases: BASES, seed: 'cp1', tool: 'pastelpencil', rungTool: 'pastelpencil', blunt: true, edge: '#06181a', edgeNib: 2.1, taper: (t) => Math.min(1, 0.3 + t * 2) });
  B.helix(P, fork, [70, y(66)], { amp: 4.6, period: 18, c1: PASTEL.gold, c2: PASTEL.sky, bases: BASES, seed: 'cp2', tool: 'pastelpencil', rungTool: 'pastelpencil', blunt: true, edge: '#06181a', edgeNib: 2.1, taper: (t) => Math.min(1, 0.3 + t * 2) });
  for (const [dx, dy, c] of [[-3, -6, PASTEL.mint], [-3, 6, PASTEL.lilac]]) { const b = B.blob(fork[0] + dx, fork[1] + dy, 5.4, 4.4, 'pol' + dx + dy, { wob: 0.15 }); P.fill([b], c, { tool: 'pastelpencil', pressure: 0.98, passes: 3 }); P.outline([b], { color: '#06181a', nib: 0.34 }); }
  cap(['the DNA unzips, and', 'each half is copied'], 6, y(64), { color: PASTEL.cream });
}

function secondCheck(P, s, cap) {
  const y = (v) => s.top + v, n = 7, gap = 5.4, R = rng('bd'), cols = Array.from({ length: n }, () => ['#d9727a', '#6fa9c2', '#d9a531', '#8fb07a'][Math.floor(R() * 4)]);
  for (const x of [16, 34]) {
    P.line([[x, y(24)], [x, y(24 + (n - 1) * gap)]], { tool: 'pencil', color: '#5b5146', pressure: 0.8, blunt: true });
    cols.forEach((c, i) => { const yy = y(24 + i * gap), e = D.ell(x, yy, 2.3, 2.3); P.fill([e], c, { tool: 'pencil', pressure: 0.98, passes: 3 }); P.outline([e], { color: '#2f2a24', nib: 0.26 }); });
  }
  cols.forEach((c, i) => { const yy = y(24 + i * gap); P.line([[19, yy], [31, yy]], { tool: 'pencil', color: '#7d7466', pressure: 0.55 }); });
  P.line([[41, y(38)], [43.8, y(41.6)], [49.4, y(33.4)]], { tool: 'pencil', color: '#b0302a', pressure: 1, blunt: true });
  const body = B.blob(148, y(30), 25, 19.5, 'g2cell', { wob: 0.05, n: 12 });
  P.fill([body], '#f3ead8', { tool: 'pencil', pressure: 0.5, passes: 2 });
  P.hatch([B.blob(156, y(38), 20, 12, 'g2sh')], '#8a8070', { angle: 40, pitch: 0.9, nib: 0.14, clip: [body] });
  P.outline([body], { color: '#3a332c', nib: 0.4 });
  const nuc = B.blob(146, y(29), 12.5, 10, 'g2nuc', { wob: 0.06 });
  P.fill([nuc], '#ddd2ea', { tool: 'pencil', pressure: 0.65, passes: 2 });
  P.outline([nuc], { color: '#4a3b55', nib: 0.32 });
  const pal = [['#7a4a8a', '#a87ab8'], ['#b0302a', '#d9727a'], ['#3f7f73', '#7ab8a8']];
  [[139, 25], [147, 23], [154, 27], [140, 33], [149, 33], [155, 35]].forEach(([cx, cy], i) => B.chromosome(P, cx, y(cy), { len: 5.4, width: 1.9, angle: (i * 0.9) % 3, colors: pal[i % 3], line: '#2a2030', nib: 0.18, tool: 'pencil', seed: 'g2c' + i, spread: 0.3 }));
  cap.avoid(8, y(20), 52, y(59)); cap.avoid(120, y(8), 176, y(52));
  cap(['the copy', 'is checked'], 10, y(64), { color: '#2f2a24', size: 3.8 });
}

function held(P, s, cap) {
  const y = (v) => s.top + v;
  specks(P, { x0: 0, y0: y(4), x1: 180, y1: y(78) }, 80, ['#8a6a9a', '#b89ac8', '#f3e9d2'], 'held', { r: 0.45, pressure: 0.6 });
  B.glow(P, 26, y(54), 22, '#6a4a74', { pressure: 0.3, steps: 3 });
  B.helix(P, [26, y(30)], [26, y(50)], { amp: 5.6, period: 16, c1: PASTEL.cream, c2: PASTEL.rose, bases: BASES, seed: 'hd1', tool: 'pastelpencil', rungTool: 'pastelpencil', blunt: true, edge: '#1c1222', edgeNib: 2.2 });
  B.helix(P, [26, y(59)], [26, y(79)], { amp: 5.6, period: 16, c1: PASTEL.cream, c2: PASTEL.rose, bases: BASES, seed: 'hd2', tool: 'pastelpencil', rungTool: 'pastelpencil', blunt: true, edge: '#1c1222', edgeNib: 2.2 });
  for (const yy of [y(50.5), y(58.5)]) { const ring = D.ell(26, yy, 9, 3.6); P.fill([ring], PASTEL.lilac, { tool: 'pastelpencil', pressure: 0.95, passes: 2 }); P.fill([D.ell(23.5, yy - 1, 4.6, 1.3)], '#efe6f7', { tool: 'pastelpencil', pressure: 0.6, passes: 1 }); P.outline([ring], { color: '#f3e9d2', nib: 0.34 }); }
  for (let k = -3; k <= 3; k++) P.line([[26 + k * 1.8, y(52.4)], [26 + k * 1.8 + 0.7, y(56.8)]], { tool: 'gel', color: '#f3e9d2', nib: 0.34 });
  cap.avoid(10, y(26), 40, y(80));
  cap(['repair proteins', 'join the break'], 40, y(54), { color: PASTEL.cream });
}

function apoptosis(P, s, cap) {
  const y = (v) => s.top + v, R = rng('apo');
  const pieces = [[36, 52, 9], [52, 46, 7], [48, 62, 8], [30, 68, 6], [62, 58, 5.5], [44, 76, 5], [58, 72, 4.2], [24, 54, 4.6]];
  B.glow(P, 44, y(60), 30, '#4a3552', { pressure: 0.25, steps: 3 });
  pieces.forEach(([x, yy, r], i) => {
    const b = B.blob(x, y(yy), r, r * 0.92, 'ap' + i, { wob: 0.1 });
    P.fill([b], [PASTEL.rose, PASTEL.blush, PASTEL.lilac][i % 3], { tool: 'pastelpencil', pressure: 0.88, passes: 2 });
    P.fill([B.blob(x - r * 0.25, y(yy) - r * 0.25, r * 0.45, r * 0.35, 'aph' + i)], '#fbeef0', { tool: 'pastelpencil', pressure: 0.5, passes: 1, clip: [b] });
    if (i % 2 === 0) P.dot(x + r * 0.2, y(yy) + r * 0.15, r * 0.24, '#5a3a6a', { tool: 'pastelpencil' });
    P.outline([b], { color: '#f3e9d2', nib: 0.28, tool: 'fineliner' });
  });
  for (let i = 0; i < 16; i++) { const x = 70 + R() * 40, yy = y(64 + R() * 30), r = 1 + R() * 1.5; const b = B.blob(x, yy, r * 1.4, r, 'pet' + i, { rot: R() * 3, wob: 0.2 }); P.fill([b], [PASTEL.rose, PASTEL.blush, PASTEL.lilac][i % 3], { tool: 'pastelpencil', pressure: 0.7, passes: 1 }); }
  const mac = B.blob(132, y(70), 24, 17, 'macro', { wob: 0.22, n: 14, rot: -0.2 });
  B.glow(P, 132, y(70), 30, '#3e3048', { pressure: 0.22, steps: 3 });
  P.fill([mac], '#8f7fa8', { tool: 'pastelpencil', pressure: 0.6, passes: 2 });
  P.fill([B.blob(126, y(64), 15, 9, 'macl')], '#b4a6c9', { tool: 'pastelpencil', pressure: 0.45, passes: 1, clip: [mac] });
  for (const [x, yy, r] of [[124, 72, 3.4], [138, 66, 2.8], [142, 76, 2.4]]) { const b = B.blob(x, y(yy), r, r * 0.9, 'in' + x); P.fill([b], PASTEL.rose, { tool: 'pastelpencil', pressure: 0.85, passes: 2 }); P.outline([b], { color: '#f3e9d2', nib: 0.22 }); }
  P.dot(118, y(66), 2.4, '#4a3a5a', { tool: 'pastelpencil' });
  P.outline([mac], { color: '#e6dcef', nib: 0.32 });
  cap.avoid(10, y(34), 70, y(84)); cap.avoid(69, y(60), 112, y(96)); cap.avoid(104, y(48), 160, y(92));
  cap(['it takes itself apart,', 'and a cleaner cell eats it'], 10, y(93), { color: PASTEL.cream, size: 3.8 });
}

function prophase(P, s, cap) {
  const y = (v) => s.top + v, R = rng('pro');
  const cols = [PASTEL.coral, PASTEL.gold, PASTEL.sky, PASTEL.mint, PASTEL.lilac, PASTEL.cream];
  specks(P, { x0: 0, y0: y(4), x1: 180, y1: y(130) }, 90, ['#3a3540', '#5a5460'], 'pro', { r: 0.4, pressure: 0.6 });
  B.glow(P, 40, y(88), 34, '#1f1c26', { pressure: 0.4, steps: 3 });
  for (let i = 0; i < 18; i++) P.line(B.squiggle(R, 40, y(88), 32, 32, 42, 2.6), { tool: 'pastelpencil', color: cols[i % cols.length], pressure: 0.85, tremor: 0.5 });
  const spots = B.scatter('prochr', { x0: 118, y0: y(30), x1: 172, y1: y(120) }, 11, 15.5);
  spots.forEach((p, i) => B.chromosome(P, p[0], p[1], { len: 12 + R() * 4, width: 3.2, angle: R() * 3, colors: [cols[i % cols.length], cols[(i + 2) % cols.length]], bands: '#2a2228', line: '#0c0b0d', nib: 0.3, seed: 'pc' + i, spread: 0.24 }));
  cap.avoid(6, y(54), 74, y(122)); cap.avoid(110, y(22), 178, y(122));
  cap('long threads of DNA', 14, y(48), { color: PASTEL.cream });
  cap('coil into chromosomes', 120, y(127), { color: PASTEL.cream });
}

function prometaphase(P, s, cap) {
  const y = (v) => s.top + v, R = rng('prm');
  B.aster(P, 4, y(54), { r0: 4, r1: 64, rays: 38, from: -0.95, span: 1.9, c1: PASTEL.gold, c2: PASTEL.cream, core: PASTEL.cream, glow: '#2b4a7a', tool: 'gel', nib: 0.34 });
  B.aster(P, 176, y(54), { r0: 4, r1: 64, rays: 38, from: Math.PI - 0.95, span: 1.9, c1: PASTEL.gold, c2: PASTEL.cream, core: PASTEL.cream, glow: '#2b4a7a', tool: 'gel', nib: 0.34 });
  for (let i = 0; i < 10; i++) { const a = R() * B.TAU, cx = 92 + (R() - 0.5) * 24, cy = y(52 + (R() - 0.5) * 32), r = 6 + R() * 4, pts = []; for (let k = 0; k <= 10; k++) { const t = a + (k / 10) * (0.7 + R() * 0.4); pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } P.line(pts, { tool: 'pastelpencil', color: PASTEL.cream, pressure: 0.88, blunt: true }); }
  cap('two poles send out fibres', 8, y(77), { color: PASTEL.cream });
  cap(['the nucleus', 'breaks open'], 172, y(72), { color: PASTEL.cream, align: 'right' });
}

function caught(P, s, cap) {
  const y = (v) => s.top + v;
  const fib = (a, b, n, spread, nib = 0.42) => { for (let i = 0; i < n; i++) { const t = (i - (n - 1) / 2) * spread; P.curve([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + t], b], { tool: 'gel', color: PASTEL.gold, nib, tremor: 0.3 }); } };
  for (const p of [[-6, y(54)], [186, y(54)]]) B.glow(P, p[0], p[1], 14, '#3e5a76', { pressure: 0.3, steps: 2 });
  fib([-6, y(54)], [21, y(55)], 4, 2.6);
  fib([186, y(54)], [31, y(55)], 3, 3.4, 0.3);
  B.chromosome(P, 26, y(55), { len: 17, width: 4, angle: 0, colors: [PASTEL.coral, PASTEL.cream], bands: '#3a2228', line: '#10161d', nib: 0.32, seed: 'ct1' });
  fib([186, y(54)], [162, y(56)], 4, 2.6);
  B.glow(P, 150, y(56), 9, '#e0675c', { pressure: 0.34, steps: 3 });
  B.chromosome(P, 156, y(56), { len: 17, width: 4, angle: 0, colors: [PASTEL.sky, PASTEL.cream], bands: '#22303d', line: '#10161d', nib: 0.32, seed: 'ct2' });
  P.dot(150.5, y(56), 1.4, PASTEL.coral, { tool: 'pastelpencil' });
  cap.avoid(10, y(40), 42, y(70)); cap.avoid(140, y(40), 172, y(72));
  cap('caught from both sides', 6, y(77), { color: PASTEL.cream });
  cap('one side loose: wait', 174, y(77.5), { color: PASTEL.cream, align: 'right', size: 3.8 });
}

function metaphase(P, s, cap) {
  const y = (v) => s.top + v, cx = 91.5, n = 6, top = y(36), bot = y(76), L = [2, y(56)], Rp = [178, y(56)], plum = '#5b2a4e';
  for (let i = 0; i < n; i++) { const yy = top + (i * (bot - top)) / (n - 1); for (const [p, x] of [[L, cx - 3], [Rp, cx + 3]]) P.curve([p, [(p[0] + x) / 2, (p[1] + yy) / 2 + (yy - p[1]) * 0.08], [x, yy]], { tool: 'pencil', color: plum, pressure: 0.8, tremor: 0.3 }); }
  for (const p of [L, Rp]) { B.glow(P, p[0], p[1], 10, '#d9a0a8', { pressure: 0.3, steps: 2 }); P.dot(p[0], p[1], 2.6, plum, { tool: 'pencil' }); }
  const cols = [['#7a3e7a', '#b0609a'], ['#5b2a4e', '#9a4a7a'], ['#8a4a8a', '#c07aa8']];
  for (let i = 0; i < n; i++) { const yy = top + (i * (bot - top)) / (n - 1); B.chromosome(P, cx, yy, { len: 7.4, width: 2.9, angle: 0, colors: cols[i % 3], bands: '#f2d2de', line: '#2f1a28', nib: 0.28, seed: 'mt' + i, tool: 'pencil', spread: 0.3 }); }
  cap(['every chromosome', 'lines up in the middle'], 6, y(34), { color: '#3a1f2c' });
}

function anaphase(P, s, cap) {
  const y = (v) => s.top + v, R = rng('ana');
  const V = (x, yy, dir, i, l) => { const back = dir < 0 ? 0 : Math.PI; for (const d of [-0.3, 0.3]) { const arm = B.chromatidArm([x, yy], back + d, l, 1.6); P.fill([arm], i % 2 ? PASTEL.cream : '#f6d58a', { tool: 'pastelpencil', pressure: 0.98, passes: 2 }); P.outline([arm], { color: '#2a140c', nib: 0.3 }); } P.dot(x, yy, 1.1, '#2a140c', { tool: 'pencil' }); };
  for (let i = 0; i < 7; i++) P.line([[52, y(44 + i * 3)], [128, y(44 + i * 3)]], { tool: 'pencil', color: '#e8bfa0', pressure: 0.5, tremor: 0.4 });
  const rows = [[36, 0], [47, 4], [58, -1], [69, 3]];
  rows.forEach(([yy, dx], i) => { const l = 7.5 + (i % 2) * 1.6; P.line([[-3, y(56)], [14 + dx, y(yy)]], { tool: 'pencil', color: '#f3e3cf', pressure: 0.75 }); P.line([[183, y(56)], [166 - dx, y(yy)]], { tool: 'pencil', color: '#f3e3cf', pressure: 0.75 }); V(14 + dx, y(yy), -1, i, l); V(166 - dx, y(yy), 1, i + 1, l); });
  cap.avoid(4, y(30), 36, y(80)); cap.avoid(144, y(30), 178, y(80));
  cap(['the sisters are pulled', 'to opposite poles'], 174, y(16), { color: '#24100a', align: 'right' });
}

function telophase(P, s, cap) {
  const y = (v) => s.top + v, R = rng('tel');
  const shape = [D.ell(46, y(54), 31, 21), D.ell(144, y(54), 31, 21), [[66, y(47)], [124, y(47)], [124, y(61)], [66, y(61)]]];
  P.fill(shape, '#f7dcc8', { tool: 'pencil', pressure: 0.7, passes: 2 });
  P.hatch([D.ell(52, y(64), 28, 12), D.ell(150, y(64), 28, 12)], '#b88a6e', { angle: 35, pitch: 1, nib: 0.14, clip: shape });
  P.outline(shape, { color: '#6a3a2a', nib: 0.45 });
  for (let i = 0; i < 6; i++) P.line([[60, y(50 + i * 1.8)], [130, y(50 + i * 1.8)]], { tool: 'pencil', color: '#d8b498', pressure: 0.4 });
  for (const dx of [-1.6, 0, 1.6]) P.dot(95 + dx, y(54), 1.4, '#6a3a2a', { tool: 'pencil' });
  for (const [nx, seed] of [[40, 'tl'], [150, 'tr']]) {
    const nuc = B.blob(nx, y(54), 12, 10.5, seed, { wob: 0.05 });
    P.fill([nuc], '#e2cde8', { tool: 'pencil', pressure: 0.65, passes: 2 });
    for (let i = 0; i < 9; i++) P.line(B.squiggle(R, nx, y(54), 10, 9, 14, 1.7), { tool: 'pencil', color: '#6b4a7a', pressure: 0.95, tremor: 0.5 });
    const ring = B.blob(nx, y(54), 12, 10.5, seed, { wob: 0.05 });
    for (let i = 0; i < ring.length; i += 7) P.line(ring.slice(i, i + 5), { tool: 'fineliner', color: '#4a2f55', nib: 0.34 });
  }
  cap(['a nucleus forms', 'on each side'], 6, y(20), { color: '#3a2016' });
}

const DAUGHTER = { cyto: '#f6dcd2', shade: '#e6b8aa', ribo: '#b98c80', mito: '#d9727a', mitoLine: '#7a2f36', line: '#5a3a3a', er: '#c99a3a', vesicle: '#a9cfe0', nucleus: '#cdb7dc', nucleusLight: '#e4d8ef', chromatin: '#6b4a7a', nucleolus: '#4a2f55', envelope: '#3d2f45', tool: 'pencil' };
function cytokinesis(P, s, cap) {
  const y = (v) => s.top + v;
  const bridge = [[64, y(52.8)], [126, y(52.8)], [126, y(57.2)], [64, y(57.2)]];
  P.fill([bridge], '#f6dcd2', { tool: 'pencil', pressure: 0.7, passes: 2 });
  P.outline([bridge], { color: '#5a3a3a', nib: 0.4 });
  B.cell(P, { cx: 44, cy: y(55), rx: 23, ry: 20, seed: 'dl', pal: DAUGHTER, mito: 5, vesicles: 6, ribo: 0.4, threads: 6 });
  B.cell(P, { cx: 146, cy: y(55), rx: 23, ry: 20, seed: 'dr', pal: DAUGHTER, mito: 5, vesicles: 6, ribo: 0.4, threads: 6 });
  for (const dx of [-2.2, 0, 2.2]) P.line([[95 + dx - 0.8, y(51.2)], [95 + dx + 0.8, y(58.8)]], { tool: 'pencil', color: '#933323', pressure: 1, blunt: true });
  cap(['a ring of protein', 'pulls tight'], 174, y(16), { color: '#2f2420', align: 'right' });
}

function pairCell(P, cx, cy, r, seed, chrom) {
  const body = B.blob(cx, cy, r, r * 0.94, seed, { wob: 0.05 });
  P.fill([body], '#f6dfd6', { tool: 'pencil', pressure: 0.72, passes: 2 });
  P.hatch([B.blob(cx + r * 0.25, cy + r * 0.35, r * 0.8, r * 0.5, seed + 's')], '#b89488', { angle: 35, pitch: 0.9, nib: 0.13, clip: [body] });
  P.outline([body], { color: '#5a3a3a', nib: 0.42 });
  const nuc = B.blob(cx, cy, r * 0.66, r * 0.6, seed + 'n', { wob: 0.05 });
  P.fill([nuc], '#ece2f2', { tool: 'pencil', pressure: 0.7, passes: 2 });
  P.outline([nuc], { color: '#4a2f55', nib: 0.3 });
  const n = chrom.length;
  chrom.forEach((c, i) => { const x = cx - (n - 1) * 2.3 + i * 4.6, yy = cy + (i % 2 ? 1.2 : -1.2); B.chromosome(P, x, yy, { len: 5.4, width: 1.9, angle: 0.25 * (i % 2 ? 1 : -1), colors: [c.c, c.c2], line: '#2a2030', nib: 0.2, tool: 'pencil', seed: seed + i, spread: 0.3 }); if (c.hurt) P.dot(x - 0.6, yy + 1.4, 1, '#c4453a', { tool: 'pencil' }); });
}
function endings(P, s, cap) {
  const y = (v) => s.top + v;
  const plum = { c: '#7a4a8a', c2: '#a87ab8' }, gold = { c: '#c99a3a', c2: '#e2b33f' }, teal = { c: '#3f7f73', c2: '#7ab8a8' }, hurt = { ...plum, hurt: true };
  pairCell(P, 50.5, y(50), 13, 'e1a', [plum, gold, gold, teal]);
  pairCell(P, 50.5, y(80), 13, 'e1b', [plum, teal]);
  pairCell(P, 94.8, y(50), 13, 'e2a', [plum, gold, teal]);
  pairCell(P, 94.8, y(80), 13, 'e2b', [plum, gold, teal]);
  pairCell(P, 134.3, y(50), 13, 'e3a', [hurt, gold, teal]);
  pairCell(P, 134.3, y(80), 13, 'e3b', [hurt, gold, teal]);
  cap(['one has an extra copy,', 'one is short'], 50.5, y(101), { color: '#2a3324', align: 'center', size: 3.8 });
  cap(['each gets one', 'of everything'], 94.8, y(101), { color: '#2a3324', align: 'center', size: 3.8 });
  cap(['both carry the', 'copied damage'], 134.3, y(101), { color: '#2a3324', align: 'center', size: 3.8 });
  P.text('Each daughter begins again at the top.', 90, y(126), { size: 5.4, color: INK, align: 'center' });
}

function wrapText(t, max) { const out = []; let line = ''; for (const w of t.split(' ')) { if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w; } else line += ' ' + w; } if (line.trim()) out.push(line.trim()); return out; }
function wheel(P, cx, cy, r) {
  const parts = [['G1', 0.42, '#a7c48f'], ['S', 0.28, '#5fa6a8'], ['G2', 0.16, '#e7e3d4'], ['M', 0.14, '#c9a0c8']];
  let a = -Math.PI / 2;
  for (const [name, f, col] of parts) {
    const a1 = a + f * B.TAU, pts = [];
    for (let k = 0; k <= 24; k++) { const t = a + (a1 - a) * (k / 24); pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
    for (let k = 24; k >= 0; k--) { const t = a + (a1 - a) * (k / 24); pts.push([cx + Math.cos(t) * r * 0.62, cy + Math.sin(t) * r * 0.62]); }
    P.fill([pts], col, { tool: 'pastelpencil', pressure: 0.9, passes: 2 });
    P.outline([pts], { color: '#0e1528', nib: 0.32 });
    const m = (a + a1) / 2;
    P.text(name, cx + Math.cos(m) * r * 0.81, cy + Math.sin(m) * r * 0.81 + 1.4, { size: 3.8, color: '#14182a', align: 'center' });
    a = a1;
  }
  P.dot(cx, cy - r * 1.02, 1.6, '#e2b33f', { tool: 'pastelpencil' });
  P.text('one', cx, cy - 0.5, { size: 3.4, color: '#f3ead6', align: 'center', face: 'sans' });
  P.text('cycle', cx, cy + 3.7, { size: 3.4, color: '#f3ead6', align: 'center', face: 'sans' });
}
function colophon(P, s) {
  const y = (v) => s.top + v, cream = '#f3ead6', soft = '#c9cfdc';
  wheel(P, 151, y(30), 16);
  let yy = y(20);
  P.text('What TLC checked', 10, yy, { size: 6.4, color: cream }); yy += 11;
  const items = [
    ['holds', 'A cell never divides before it copies its DNA.'],
    ['holds', 'A cell never gets stuck.'],
    ['breaks', 'Without p53, damaged DNA gets copied, and both daughters carry the mutation. TLC found it in 11 steps.'],
    ['breaks', 'Without the spindle check, the sisters are pulled apart too soon, and the daughters get the wrong chromosomes. 9 steps.'],
  ];
  for (const [i, [kind, t]] of items.entries()) {
    const lines = wrapText(t, i < 2 ? 26 : 46);
    P.dot(13, yy - 1.4, 1.6, kind === 'holds' ? '#e2b33f' : '#e0675c', { tool: 'pastelpencil' });
    lines.forEach((l, k) => P.text(l, 19, yy + k * 5.6, { size: 4.2, color: cream }));
    yy += lines.length * 5.6 + 3.6;
  }
}

function looks(wall, sheets) {
  const L = [
    look('title', 'hotpress', false, { alt: 'One becomes two. The life of one cell, drawn as a statechart. Each glass slide is a state a cell can be in. Each thread is a step it can take. TLC, a model checker, tried every one: 61 states and 77 steps. A gold thread is a healthy cell, a red thread is what TLC found when a check breaks, and a pale thread is every other step. Below, a tissue of pink cells like a stained slide; one cell, outlined in gold, is where the thread begins.' }),
    look('growing', { base: '#cbd5bd', tooth: 0.5, fibre: 0.5 }, false, { alt: 'Getting ready (interphase). A large cell with its nucleus, mitochondria and folds of membrane; sugar molecules drift toward it.' }),
    look('first-check', 'kraft', false, { alt: 'On brown paper, a long DNA double helix. On the left, rays of sunlight break it; on the right, the protein p53 clamps onto it and holds the cell still.' }),
    look('copying', 'teal', true, { alt: 'On dark teal, the DNA unzips at a fork and each half becomes a new double helix, gold and pale blue.' }),
    look('second-check', 'graph', false, { alt: 'On graph paper, two columns of coloured beads match one for one with a red tick, and a cell sketch now holds two of every chromosome.' }),
    look('held', { base: '#4a3550', tooth: 0.55, fibre: 0.55 }, true, { alt: 'On plum paper, a broken DNA helix with two ring-shaped repair proteins stitching the ends together.' }),
    look('apoptosis', { base: '#2f2236', tooth: 0.55, fibre: 0.55 }, true, { alt: 'A cell breaks into neat round pieces, and a larger cleaner cell swallows them.' }),
    look('prophase', 'black', true, { alt: 'Dividing (mitosis). On black, a tangle of coloured DNA threads on the left; on the right, the threads have coiled into X-shaped, banded chromosomes.' }),
    look('prometaphase', 'navy', true, { alt: 'On navy, two golden spindle poles shine fibres in from the left and right while pieces of the broken nucleus drift between them.' }),
    look('caught', { base: '#2c3f52', tooth: 0.55, fibre: 0.55 }, true, { alt: 'Gold fibres catch chromosomes. On the left, one is held from both sides; on the right, one is held from one side only, its loose side glowing red.' }),
    look('metaphase', { base: '#e8c5bb', tooth: 0.5, fibre: 0.5 }, false, { alt: 'On pink paper, six purple chromosomes line up in a column in the middle, with fibres running to a pole on each side.' }),
    look('anaphase', { base: '#bf7657', tooth: 0.55, fibre: 0.6 }, false, { alt: 'On terracotta, V-shaped chromatids are pulled to the far left and far right poles.' }),
    look('telophase', { base: '#f0cfb0', tooth: 0.5, fibre: 0.5 }, false, { alt: 'On peach paper, a long cell with a pinched waist, a new nucleus forming at each end.' }),
    look('cytokinesis', 'cartridge', false, { alt: 'Two daughter cells, each with its own nucleus and mitochondria, still joined by a thin bridge tied with a red ring.' }),
    look('endings', { base: '#dfe4d0', tooth: 0.5, fibre: 0.5 }, false, { alt: 'Three pairs of daughter cells. Left: one has an extra chromosome and one is short. Middle: each has one of everything. Right: both carry a red mark, the copied damage. Each daughter begins again at the top.' }),
    look('colophon', 'navy', true, { alt: 'What TLC checked, beside a ring showing one cycle: G1, S, G2 and M.' }),
  ];
  L[0].back = (P, s) => title(P, s, wall);
  L[0].front = (P, s) => { const r = titleFront(P, s, wall); L[0].credits = r.credits; L[0].step = r.step; };
  L[1].back = (P, s) => growing(P, s, captioner(P, s, wall));
  L[1].front = (P, s) => header(P, s.top + 18, 'Getting ready', '(interphase)', { size: 9 });
  L[2].back = (P, s) => firstCheck(P, s, captioner(P, s, wall));
  L[3].back = (P, s) => copying(P, s, captioner(P, s, wall));
  L[4].back = (P, s) => secondCheck(P, s, captioner(P, s, wall));
  L[5].back = (P, s) => held(P, s, captioner(P, s, wall));
  L[6].back = (P, s) => apoptosis(P, s, captioner(P, s, wall));
  L[7].back = (P, s) => prophase(P, s, captioner(P, s, wall));
  L[7].front = (P, s) => header(P, s.top + 24, 'Dividing', '(mitosis)', { size: 9, color: '#f3ead6' });
  L[8].back = (P, s) => prometaphase(P, s, captioner(P, s, wall));
  L[9].back = (P, s) => caught(P, s, captioner(P, s, wall));
  L[10].back = (P, s) => metaphase(P, s, captioner(P, s, wall));
  L[11].back = (P, s) => anaphase(P, s, captioner(P, s, wall));
  L[12].back = (P, s) => telophase(P, s, captioner(P, s, wall));
  L[13].back = (P, s) => cytokinesis(P, s, captioner(P, s, wall));
  L[14].back = (P, s) => endings(P, s, captioner(P, s, wall));
  L[15].back = (P, s) => colophon(P, s);
  return L;
}

module.exports = { looks, seam, baseOf, INK };
