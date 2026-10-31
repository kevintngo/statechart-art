'use strict';
const path = require('path');
const fs = require('fs');
const { rng } = require('../../tools/kit/util');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { createCanvas, GlobalFonts, ImageData } = tools('@napi-rs/canvas');

const FONTS = path.join(__dirname, '..', '..', 'tools', 'fonts');
GlobalFonts.registerFromPath(path.join(FONTS, 'KevinSans-Bold.ttf'), 'Kevin Sans Bold');
const FACE = 'Kevin Sans Bold';

const ROOT = path.join(__dirname, '..');
const OUT_PNG = path.join(ROOT, 'out', 'tex', 'sampler.png');
const OUT_JSON = path.join(ROOT, 'out', 'sampler.json');
const COUNTS = (() => { const m = fs.readFileSync(path.join(ROOT, 'model', 'chart', 'report.md'), 'utf8').match(/TLC reached (\d+) states and (\d+) steps/); if (!m) throw new Error('no TLC counts in report.md'); return [m[1], m[2]]; })();
const ARG = (k, d) => { const a = process.argv.find((s) => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

const PAL = {
  ink: '#1d1a1e', gold: '#e2b33f', goldPale: '#f6ecd2', red: '#c4453a', redPale: '#ef9a8c', cream: '#efe6d2',
  navy: '#26304f', plum: '#3a2f45', rust: '#7a3b2c', linen: '#e9dfcc',
  oldGold: '#674709', oldGoldPale: '#9a6d22', brick: '#7f2820', brickPale: '#9c3a2c', slate: '#4a5160', slatePale: '#6a717e', knotRed: '#e2584a',
};

const probe = createCanvas(8, 8).getContext('2d');
const textW = (t, size) => { probe.font = `${size}px "${FACE}"`; return probe.measureText(t).width; };

const W = 1800;
const SZ = { state: 26, label: 19.5, region: 34, title: 118, sub: 22, frame: 22 };
const LP = 1.24;
const PH = 104;
const BX = 30;
const PADX = 25;

const STATES = [
  ['s0', 'Filling with propellant', ['Filling with', 'propellant'], 'booster', 'main', 0, 'path'],
  ['s1', 'Holding the count', ['Holding', 'the count'], 'booster', 'side', 0, 'side'],
  ['s2', 'Lifting off', ['Lifting off'], 'booster', 'main', 1, 'path'],
  ['s3', 'Through max Q', ['Through', 'max Q'], 'booster', 'main', 2, 'path'],
  ['s4', 'Scrubbed for today', ['Scrubbed', 'for today'], 'booster', 'side', 1, 'side'],
  ['s5', 'Hot staging', ['Hot staging'], 'booster', 'main', 3, 'path'],
  ['s6', 'Flipping, burning back', ['Flipping,', 'burning back'], 'booster', 'main', 4, 'path'],
  ['s7', 'Falling home', ['Falling home'], 'booster', 'main', 5, 'path'],
  ['s8', 'Diverted to the sea', ['Diverted to', 'the sea'], 'booster', 'side', 5, 'side'],
  ['s9', 'Coming in on a failed check', ['Coming in on', 'a failed check'], 'booster', 'side', 6, 'breaks'],
  ['s10', 'Slowing over the tower', ['Slowing over', 'the tower'], 'booster', 'main', 6, 'path'],
  ['s11', 'Hits the tower', ['Hits', 'the tower'], 'booster', 'side', 7, 'breaks'],
  ['s12', 'Caught by the arms', ['Caught by', 'the arms'], 'booster', 'main', 7, 'path'],
  ['s13', 'Riding on top', ['Riding', 'on top'], 'ship', 'main', 0, 'path'],
  ['s14', 'Engines lit while attached', ['Engines lit', 'while attached'], 'ship', 'main', 3, 'path'],
  ['s15', 'Flying on to space', ['Flying on', 'to space'], 'ship', 'main', 4, 'path'],
  ['s16', 'Falling back, glowing', ['Falling back,', 'glowing'], 'ship', 'main', 5, 'path'],
  ['s17', 'Flipping upright', ['Flipping', 'upright'], 'ship', 'main', 6, 'path'],
  ['s18', 'Splashed down', ['Splashed', 'down'], 'ship', 'main', 7, 'path'],
  ['s19', 'Arms open, waiting', ['Arms open,', 'waiting'], 'tower', 'main', 0, 'path'],
  ['s20', 'Arms closing', ['Arms', 'closing'], 'tower', 'main', 6, 'path'],
  ['s21', 'Damaged', ['Damaged'], 'tower', 'side', 7, 'breaks'],
  ['s22', 'Holding the booster', ['Holding', 'the booster'], 'tower', 'main', 7, 'path'],
].map(([id, name, lines, col, lane, row, kind]) => ({ id, name, lines, col, lane, row, kind }));
const S = Object.fromEntries(STATES.map((s) => [s.id, s]));
const BUG = new Set(['s0', 's2', 's3', 's5', 's6', 's9', 's11', 's13', 's14', 's15', 's19', 's20', 's21']);

const REGIONS = [['booster', 'The booster'], ['ship', 'The ship'], ['tower', 'The tower']];

const ARROWS = [
  ['s0', 's1', ['a hold', 'is called'], 'grey'],
  ['s0', 's2', ['the count', 'reaches zero'], 'gold'],
  ['s1', 's0', ['the count', 'resumes'], 'grey'],
  ['s1', 's4', ['the launch', 'is scrubbed'], 'grey'],
  ['s2', 's3', ['the air presses', 'hardest'], 'gold'],
  ['s3', 's5', ['most of the', 'booster’s engines', 'cut off'], 'gold'],
  ['s5', 's6', ['the ship', 'pulls away'], 'gold'],
  ['s6', 's7', ['every check passes:', 'go for catch'], 'gold'],
  ['s6', 's8', ['a check', 'fails: no-go'], 'grey'],
  ['s6', 's9', ['a check fails,', 'it comes in anyway', '[no go/no-go poll]'], 'red'],
  ['s7', 's10', ['the landing', 'burn starts'], 'gold'],
  ['s9', 's11', ['it hits the tower', '[when the arms', 'are closing]'], 'red'],
  ['s10', 's12', ['the arms catch it', '[when the arms', 'are closing]'], 'gold'],
  ['s13', 's14', ['most of the', 'booster’s engines', 'cut off [when', 'the booster is', 'through max Q]'], 'gold'],
  ['s14', 's15', ['the ship', 'pulls away'], 'gold'],
  ['s15', 's16', ['falls back', 'into the air'], 'gold'],
  ['s16', 's17', ['flips and lights', 'its engines'], 'gold'],
  ['s17', 's18', ['touches', 'the water'], 'gold'],
  ['s19', 's20', ['the arms close', '[when the booster', 'is coming in on a', 'failed check or', 'slowing over the', 'tower, and the ship', 'has pulled away]'], 'gold'],
  ['s20', 's21', ['it hits the tower', '[when the booster', 'is coming in on', 'a failed check]'], 'red'],
  ['s20', 's22', ['the arms catch it', '[when the booster', 'is slowing over', 'the tower]'], 'gold'],
].map(([from, to, lines, thread]) => ({ from, to, lines, thread }));

function layout() {
  const L = { W };
  const laneW = {};
  for (const s of STATES) { const k = s.col + ':' + s.lane; laneW[k] = Math.max(laneW[k] || 0, ...s.lines.map((t) => textW(t, SZ.state))); }
  for (const k in laneW) laneW[k] = Math.ceil(laneW[k] + 2 * PADX);
  const F = { x0: 50, x1: W - 50, y0: 262 };
  const gut = 26, pad = 18, edge = 8;
  const lab = (lines) => Math.max(...lines.map((t) => textW(t, SZ.label)));
  const bMain = laneW['booster:main'], bSide = laneW['booster:side'], laneGap = Math.ceil(lab(['fails: no-go']) + 30);
  const rightExtra = Math.max(0, Math.ceil(lab(['every check passes:']) + 16 + 8 - bMain / 2 - BX));
  const tMain = laneW['tower:main'], tSide = laneW['tower:side'], tGap = 40;
  const colW = { booster: edge + bSide + laneGap + bMain + rightExtra, tower: edge + tMain + tGap + tSide + edge };
  colW.ship = F.x1 - F.x0 - 2 * pad - 4 * gut - colW.booster - colW.tower;
  const col = {};
  col.booster = [F.x0 + pad, F.x0 + pad + colW.booster];
  col.ship = [col.booster[1] + 2 * gut, col.booster[1] + 2 * gut + colW.ship];
  col.tower = [col.ship[1] + 2 * gut, col.ship[1] + 2 * gut + colW.tower];
  const seps = [col.booster[1] + gut, col.ship[1] + gut];
  const laneX = {
    'booster:side': col.booster[0] + edge + bSide / 2,
    'booster:main': col.booster[0] + edge + bSide + laneGap + bMain / 2,
    'ship:main': (col.ship[0] + col.ship[1]) / 2 - 16,
    'tower:main': col.tower[0] + edge + tMain / 2,
    'tower:side': col.tower[0] + edge + tMain + tGap + tSide / 2,
  };
  const gaps = [96, 80, 100, 80, 84, 112, 124];
  const rowY = [F.y0 + 170 + PH / 2];
  for (let k = 1; k < 8; k++) rowY[k] = rowY[k - 1] + PH + gaps[k - 1];
  const P = {};
  for (const s of STATES) {
    const w = laneW[s.col + ':' + s.lane], cx = laneX[s.col + ':' + s.lane], cy = rowY[s.row];
    P[s.id] = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - PH / 2, y1: cy + PH / 2, cx, cy, w, h: PH };
  }
  F.y1 = rowY[7] + PH / 2 + 44;
  const X = { b: P.s0.cx - BX, side: P.s1.cx - 40, side2: P.s9.cx + 40, ship: P.s13.cx - 66, tower: P.s19.cx - 40 };
  Object.assign(L, { F, col, seps, laneX, rowY, P, gut, X });
  L.H = Math.round(F.y1 + 190);
  return L;
}

const lerp = (a, b, t) => a + (b - a) * t;
function routes(L) {
  const { P, X } = L, G0 = 10, G1 = 13;
  const top = (s, f = 0.5, g = G1) => [lerp(P[s].x0, P[s].x1, f), P[s].y0 - g];
  const bot = (s, f = 0.5, g = G0) => [lerp(P[s].x0, P[s].x1, f), P[s].y1 + g];
  const lft = (s, f = 0.5, g = G1) => [P[s].x0 - g, lerp(P[s].y0, P[s].y1, f)];
  const rgt = (s, f = 0.5, g = G0) => [P[s].x1 + g, lerp(P[s].y0, P[s].y1, f)];
  const vx = (s, t, x) => [[x, P[s].y1 + G0], [x, P[t].y0 - G1]];
  const lg = (P.s1.x1 + P.s0.x0) / 2;
  return {
    's0>s1': [lft('s0', 0.3, G0), [lg, P.s0.cy - PH * 0.27], rgt('s1', 0.3, G1)],
    's1>s0': [rgt('s1', 0.72, G0), [lg, P.s0.cy + PH * 0.27], lft('s0', 0.72, G1)],
    's0>s2': vx('s0', 's2', X.b), 's2>s3': vx('s2', 's3', X.b), 's3>s5': vx('s3', 's5', X.b), 's5>s6': vx('s5', 's6', X.b), 's6>s7': vx('s6', 's7', X.b),
    's1>s4': vx('s1', 's4', X.side),
    's6>s8': [lft('s6', 0.38, G0), [lerp(P.s8.x0, P.s8.x1, 0.62) + 26, P.s6.cy - PH * 0.12 + 4], top('s8', 0.62)],
    's6>s9': [bot('s6', 0.1), [P.s6.x0 - 18, P.s6.y1 + 46], [P.s8.x1 + 34, P.s8.cy + PH * 0.2], [P.s9.x1 + 58, P.s9.cy - 16], rgt('s9', 0.4, G1)],
    's7>s10': vx('s7', 's10', X.b), 's10>s12': vx('s10', 's12', X.b), 's9>s11': vx('s9', 's11', X.side2),
    's13>s14': vx('s13', 's14', X.ship), 's14>s15': vx('s14', 's15', X.ship), 's15>s16': vx('s15', 's16', X.ship), 's16>s17': vx('s16', 's17', X.ship), 's17>s18': vx('s17', 's18', X.ship),
    's19>s20': vx('s19', 's20', X.tower),
    's20>s22': vx('s20', 's22', X.tower),
    's20>s21': [rgt('s20', 0.36, G0), [P.s21.cx - 30, P.s20.y0 + PH * 0.36 + 4], [P.s21.cx, P.s20.y1 + 34], top('s21', 0.5)],
  };
}

function labelBox(lines, x, y, align, valign) {
  const w = Math.max(...lines.map((t) => textW(t, SZ.label))), lh = SZ.label * LP, h = lines.length * lh - (lh - SZ.label) + SZ.label * 0.22;
  const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  const y0 = valign === 'top' ? y : valign === 'bottom' ? y - h : y - h / 2;
  return { x0, y0, x1: x0 + w, y1: y0 + h, w, h, align, lines };
}

function labels(L, R) {
  const { P, X } = L, out = {};
  const mid = (a, b) => (a + b) / 2;
  const gapMid = (s, t) => mid(P[s].y1, P[t].y0);
  const lines = (k) => ARROWS.find((a) => a.from + '>' + a.to === k).lines;
  const right = (k, x, y, v = 'middle') => labelBox(lines(k), x, y, 'left', v);
  const center = (k, x, y, v) => labelBox(lines(k), x, y, 'center', v);
  const lg = (P.s1.x1 + P.s0.x0) / 2;
  out['s0>s1'] = center('s0>s1', lg, P.s0.cy - PH * 0.27 - 12, 'bottom');
  out['s1>s0'] = center('s1>s0', lg, P.s0.cy + PH * 0.27 + 12, 'top');
  for (const [a, b] of [['s0', 's2'], ['s2', 's3'], ['s3', 's5'], ['s5', 's6'], ['s6', 's7'], ['s7', 's10'], ['s10', 's12']]) out[a + '>' + b] = right(a + '>' + b, X.b + 16, gapMid(a, b));
  out['s1>s4'] = right('s1>s4', X.side + 16, gapMid('s1', 's4'));
  out['s6>s8'] = center('s6>s8', mid(P.s8.x1, P.s6.x0) - 24, R['s6>s8'][0][1] - 20, 'bottom');
  out['s6>s9'] = right('s6>s9', P.s8.x0 + 4, gapMid('s8', 's9') - 4);
  out['s9>s11'] = right('s9>s11', X.side2 + 16, gapMid('s9', 's11'));
  out['s13>s14'] = right('s13>s14', X.ship + 16, mid(P.s13.y1, P.s14.y0));
  for (const [a, b] of [['s14', 's15'], ['s15', 's16'], ['s16', 's17'], ['s17', 's18']]) out[a + '>' + b] = right(a + '>' + b, X.ship + 16, gapMid(a, b));
  out['s19>s20'] = right('s19>s20', X.tower + 16, mid(P.s19.y1, P.s20.y0));
  out['s20>s22'] = right('s20>s22', X.tower + 16, gapMid('s20', 's22'));
  out['s20>s21'] = right('s20>s21', P.s20.x1 + 16, P.s20.y0 + PH * 0.36 - 14, 'bottom');
  return out;
}

function smoothPath(pts, step = 2) {
  if (pts.length === 2) { const [a, b] = pts, n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); return Array.from({ length: n + 1 }, (_, i) => [lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)]); }
  const P = [pts[0].map((v, i) => 2 * v - pts[1][i]), ...pts, pts[pts.length - 1].map((v, i) => 2 * v - pts[pts.length - 2][i])], out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2], m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t; out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

function boxDist(b, p) { const dx = Math.max(b.x0 - p[0], 0, p[0] - b.x1), dy = Math.max(b.y0 - p[1], 0, p[1] - b.y1); return Math.hypot(dx, dy); }
function overlap(a, b, m = 0) { return a.x0 - m < b.x1 && b.x0 - m < a.x1 && a.y0 - m < b.y1 && b.y0 - m < a.y1; }

function check(L, R, LB, extra = []) {
  const issues = [], paths = Object.fromEntries(Object.entries(R).map(([k, v]) => [k, smoothPath(v)]));
  const boxes = Object.entries(L.P).map(([id, b]) => ({ id, ...b }));
  for (const [k, b] of Object.entries(LB)) {
    for (const p of boxes) if (overlap(b, p, 8)) issues.push(`label ${k} hits patch ${p.id}`);
    for (const [k2, pts] of Object.entries(paths)) { const d = Math.min(...pts.map((q) => boxDist(b, q))); if (d < 9) issues.push(`label ${k} near path ${k2} (${d.toFixed(1)})`); }
    for (const [k2, b2] of Object.entries(LB)) if (k2 > k && overlap(b, b2, 8)) issues.push(`label ${k} hits label ${k2}`);
    for (const [k2, b2] of extra) if (overlap(b, b2, 8)) issues.push(`label ${k} hits ${k2}`);
    const c = REGIONS.map(([r]) => r).find((r) => b.x0 >= L.col[r][0] - 2 && b.x1 <= L.col[r][1] + 2);
    if (!c) issues.push(`label ${k} leaves its column`);
  }
  for (const [k, pts] of Object.entries(paths)) for (const p of boxes) {
    if (k.startsWith(p.id + '>') || k.endsWith('>' + p.id)) continue;
    const d = Math.min(...pts.map((q) => boxDist(p, q))); if (d < 10) issues.push(`path ${k} near patch ${p.id} (${d.toFixed(1)})`);
  }
  return issues;
}

async function wire(L, R, LB) {
  const c = createCanvas(L.W, L.H), g = c.getContext('2d');
  g.fillStyle = '#d9cdb3'; g.fillRect(0, 0, L.W, L.H);
  g.strokeStyle = PAL.ink; g.lineWidth = 2; g.strokeRect(L.F.x0, L.F.y0, L.F.x1 - L.F.x0, L.F.y1 - L.F.y0);
  g.setLineDash([12, 9]); for (const x of L.seps) { g.beginPath(); g.moveTo(x, L.F.y0 + 14); g.lineTo(x, L.F.y1 - 14); g.stroke(); } g.setLineDash([]);
  const fill = { path: PAL.navy, side: PAL.linen, breaks: PAL.rust }, edge = { path: PAL.gold, side: PAL.slate, breaks: PAL.red };
  for (const s of STATES) {
    const b = L.P[s.id]; g.fillStyle = fill[s.kind]; g.fillRect(b.x0, b.y0, b.w, b.h); g.strokeStyle = edge[s.kind]; g.lineWidth = 9; g.strokeRect(b.x0 + 4.5, b.y0 + 4.5, b.w - 9, b.h - 9);
    g.fillStyle = s.kind === 'side' ? PAL.ink : PAL.cream; g.font = `${SZ.state}px "${FACE}"`; g.textAlign = 'center';
    const n = s.lines.length; s.lines.forEach((t, i) => g.fillText(t, b.cx, b.cy + (i - (n - 1) / 2) * SZ.state * LP + SZ.state * 0.36));
  }
  const tc = { gold: PAL.oldGold, red: PAL.brick, grey: PAL.slate };
  for (const a of ARROWS) {
    const pts = smoothPath(R[a.from + '>' + a.to]); g.strokeStyle = tc[a.thread]; g.lineWidth = 4; g.setLineDash([13, 7]);
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.stroke(); g.setLineDash([]);
    const e = pts[pts.length - 1], q = pts[Math.max(0, pts.length - 6)], an = Math.atan2(e[1] - q[1], e[0] - q[0]);
    g.beginPath(); g.moveTo(e[0] - Math.cos(an - 0.55) * 16, e[1] - Math.sin(an - 0.55) * 16); g.lineTo(...e); g.lineTo(e[0] - Math.cos(an + 0.55) * 16, e[1] - Math.sin(an + 0.55) * 16); g.stroke();
  }
  g.font = `${SZ.label}px "${FACE}"`; g.fillStyle = PAL.ink;
  for (const b of Object.values(LB)) {
    g.textAlign = b.align === 'left' ? 'left' : b.align === 'right' ? 'right' : 'center';
    const x = b.align === 'left' ? b.x0 : b.align === 'right' ? b.x1 : (b.x0 + b.x1) / 2;
    b.lines.forEach((t, i) => g.fillText(t, x, b.y0 + SZ.label * 0.8 + i * SZ.label * LP));
    g.strokeStyle = 'rgba(200,0,120,0.35)'; g.lineWidth = 1; g.strokeRect(b.x0, b.y0, b.w, b.h);
  }
  g.font = `${SZ.region}px "${FACE}"`; g.textAlign = 'center';
  for (const [r, name] of REGIONS) g.fillText(name, (L.col[r][0] + L.col[r][1]) / 2, L.F.y0 + 58);
  g.font = `${SZ.title}px "${FACE}"`; g.fillText('Catch', W / 2, 168);
  const f = path.join(ARG('wire-out', path.join(ROOT, 'out')), 'sampler-wire.png'); fs.writeFileSync(f, await c.encode('png')); console.log('wire', f, L.W, L.H);
}

const K = Number(ARG('k', 2));
const PI = Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lin = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2)); };
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function hash(i, j, s) { let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vn1(s, t) { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f), a = hash(i, 0, s), b = hash(i + 1, 0, s); return a + (b - a) * u; }
function vn2(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; }
function fbm(x, y, s, o = 4) { let v = 0, a = 0.5, f = 1, n = 0; for (let k = 0; k < o; k++) { v += a * vn2(x * f, y * f, s + k * 131); n += a; a *= 0.5; f *= 2.03; } return v / n; }

const TH = {
  gold: { col: lin(PAL.gold), pale: lin(PAL.goldPale), plies: 6, spec: 0.34 },
  red: { col: lin(PAL.red), pale: lin(PAL.redPale), plies: 6, spec: 0.28 },
  cream: { col: lin(PAL.cream), pale: null, plies: 3, spec: 0.22 },
  ink: { col: lin(PAL.ink), pale: lin('#3a343c'), plies: 5, spec: 0.22 },
  oldGold: { col: lin(PAL.oldGold), pale: lin(PAL.oldGoldPale), plies: 6, spec: 0.3 },
  brick: { col: lin(PAL.brick), pale: lin(PAL.brickPale), plies: 6, spec: 0.26 },
  slate: { col: lin(PAL.slate), pale: lin(PAL.slatePale), plies: 4, spec: 0.2 },
  knot: { col: lin(PAL.knotRed), pale: lin(PAL.redPale), plies: 6, spec: 0.28 },
};

const RTH = { gold: { ...TH.oldGold, plies: 7 }, red: { ...TH.brick, plies: 7 }, grey: TH.slate, ink: TH.ink };
const RUN = { w: 5.0, dash: 18, gap: 5.5, head: true, headLen: 18, flat: 0.5, taper: 0.74 };

function cloth(w, h) { const n = w * h; return { w, h, H: new Float32Array(n), R: new Float32Array(n), G: new Float32Array(n), B: new Float32Array(n), S: new Float32Array(n) }; }

function weave(C, o) {
  const { w, h, H, R, G, B, S } = C, p = o.pitch, rnd = rng('weave:' + o.seed);
  const nx = Math.ceil(w / p) + 5, ny = Math.ceil(h / p) + 5;
  const wc = new Float32Array(nx * h), wh = new Float32Array(nx * h), fc = new Float32Array(ny * w), fh = new Float32Array(ny * w);
  const wt = new Float32Array(nx), ft = new Float32Array(ny), ws = new Int32Array(nx), fs2 = new Int32Array(ny);
  const threads = (n, len, cA, hA, tA, sA) => {
    for (let i = 0; i < n; i++) {
      const off = rnd.gauss(0, 0.09 * p), wid = 0.5 * p * clamp(0.9 + rnd.gauss(0, 0.07), 0.72, 1.02), s1 = (rnd() * 1e9) | 0, s2 = (rnd() * 1e9) | 0;
      tA[i] = rnd.gauss(0, 1); sA[i] = (rnd() * 1e9) | 0;
      for (let t = 0; t < len; t++) {
        const wan = (vn1(s1, t / (9 * p)) - 0.5) * 0.34 * p, sl = Math.max(0, vn1(s2, t / (4.5 * p)) - 0.66) * 2.6;
        cA[i * len + t] = (i - 2) * p + off + wan; hA[i * len + t] = wid * (1 + 0.5 * sl);
      }
    }
  };
  threads(nx, h, wc, wh, wt, ws); threads(ny, w, fc, fh, ft, fs2);
  const col = o.color, Ath = o.thick, Aarc = o.arc, ms = (rnd() * 1e9) | 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xc = x + 0.5, yc = y + 0.5;
      let top = -Ath * 0.9, kind = 0, tone = 0, fib = 0, prof = 0;
      const ib = Math.floor(x / p) + 2;
      for (let i = ib - 1; i <= ib + 1; i++) {
        const k = i * h + y, hw = wh[k], d = xc - wc[k];
        if (d >= hw || d <= -hw) continue;
        const u = d / hw, pr = Math.sqrt(1 - u * u), hh = Ath * pr + Aarc * Math.cos(PI * yc / p + PI * i);
        if (hh > top) { top = hh; kind = 1; tone = wt[i]; prof = pr; fib = vn1(ws[i] + Math.floor((u + 1) * 2.2) * 7919, yc / (0.7 * p)); }
      }
      const jb = Math.floor(y / p) + 2;
      for (let j = jb - 1; j <= jb + 1; j++) {
        const k = j * w + x, hw = fh[k], d = yc - fc[k];
        if (d >= hw || d <= -hw) continue;
        const u = d / hw, pr = Math.sqrt(1 - u * u), hh = Ath * pr - Aarc * Math.cos(PI * xc / p + PI * j);
        if (hh > top) { top = hh; kind = 2; tone = ft[j]; prof = pr; fib = vn1(fs2[j] + Math.floor((u + 1) * 2.2) * 7919, xc / (0.7 * p)); }
      }
      const i = y * w + x;
      H[i] = top;
      const mot = 1 + 0.05 * (vn2(x / (60 * p), y / (60 * p), ms) - 0.5) + 0.03 * (vn2(x / (12 * p), y / (12 * p), ms + 1) - 0.5);
      if (kind === 0) { R[i] = col[0] * 0.5 * mot; G[i] = col[1] * 0.47 * mot; B[i] = col[2] * 0.43 * mot; S[i] = 0; continue; }
      const m = mot * (1 + 0.075 * tone) * (0.9 + 0.2 * fib) * (0.86 + 0.14 * prof) * (0.97 + 0.06 * hash(x, y, 5));
      R[i] = col[0] * m; G[i] = col[1] * m; B[i] = col[2] * m * (0.985 + 0.03 * fib); S[i] = 0.05 * prof;
    }
  }
}

function wobbler(seed, amp) {
  const r = rng('wob:' + seed), terms = [];
  for (let k = 2; k <= 11; k++) terms.push([k, amp * (0.9 / Math.pow(k, 0.8)) * (0.4 + 0.6 * r()), r() * PI * 2]);
  return (th) => { let v = 0; for (const [k, a, ph] of terms) v += a * Math.sin(k * th + ph); return v; };
}
function sdRR(qx, qy, hx, hy, r) { const dx = Math.abs(qx) - (hx - r), dy = Math.abs(qy) - (hy - r); return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r; }
function rrPath(b, wob, step = 0.6) {
  const { cx, cy, hx, hy, r } = b, pts = [];
  const seg = (x0, y0, x1, y1, nx, ny) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, nx, ny]); } };
  const arc = (ax, ay, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / step)); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([ax + Math.cos(a) * r, ay + Math.sin(a) * r, Math.cos(a), Math.sin(a)]); } };
  const ix = hx - r, iy = hy - r;
  seg(cx - ix, cy - hy, cx + ix, cy - hy, 0, -1); arc(cx + ix, cy - iy, -PI / 2, 0);
  seg(cx + hx, cy - iy, cx + hx, cy + iy, 1, 0); arc(cx + ix, cy + iy, 0, PI / 2);
  seg(cx + ix, cy + hy, cx - ix, cy + hy, 0, 1); arc(cx - ix, cy + iy, PI / 2, PI);
  seg(cx - hx, cy + iy, cx - hx, cy - iy, -1, 0); arc(cx - ix, cy - iy, PI, PI * 1.5);
  const cr = Math.cos(b.rot || 0), sr = Math.sin(b.rot || 0);
  return pts.map(([x, y, nx, ny]) => { const d = wob(Math.atan2((y - cy) / hy, (x - cx) / hx)), px = x + nx * d - cx, py = y + ny * d - cy; return [cx + px * cr - py * sr, cy + px * sr + py * cr, nx * cr - ny * sr, nx * sr + ny * cr]; });
}

function patch(C, b, o) {
  const { w, H, R, G, B, S } = C, wob = o.wob, base = o.base, thick = o.thick, col = o.color, sd = (rng('patch:' + o.seed)() * 1e9) | 0;
  const x0 = Math.max(0, Math.floor(b.cx - b.hx - 4)), x1 = Math.min(C.w - 1, Math.ceil(b.cx + b.hx + 4)), y0 = Math.max(0, Math.floor(b.cy - b.hy - 4)), y1 = Math.min(C.h - 1, Math.ceil(b.cy + b.hy + 4));
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, fib = new Float32Array(bw * bh);
  if (o.kind === 'felt') {
    const r = rng('fibre:' + o.seed), n = Math.round(bw * bh * 0.85);
    for (let k = 0; k < n; k++) {
      let x = r() * bw, y = r() * bh, a = r() * PI * 2; const len = (2.2 + 7.5 * r() * r()) * K, cu = r.gauss(0, 0.18) / K, light = r() < 0.56, amp = (light ? 0.19 : -0.14) * (0.3 + 0.7 * r());
      for (let s = 0; s < len; s += 0.7) { const xi = x | 0, yi = y | 0; if (xi >= 0 && yi >= 0 && xi < bw && yi < bh) fib[yi * bw + xi] += amp * Math.sin(PI * s / len); x += Math.cos(a) * 0.7; y += Math.sin(a) * 0.7; a += cu; }
    }
  }
  const lp = 3.1 * K, rot = 0.035, ca = Math.cos(rot), sa = Math.sin(rot), rc = Math.cos(b.rot || 0), rs = Math.sin(b.rot || 0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ox = x + 0.5 - b.cx, oy = y + 0.5 - b.cy, qx = ox * rc + oy * rs, qy = -ox * rs + oy * rc, d = sdRR(qx, qy, b.hx, b.hy, b.r) - wob(Math.atan2(qy / b.hy, qx / b.hx));
    if (d > 0.6) continue;
    const a = clamp(0.5 - d, 0, 1), i = y * w + x, f = fib[(y - y0) * bw + (x - x0)];
    let hh, m, sp = 0;
    if (o.kind === 'felt') {
      const mot = (fbm(x / (9 * K), y / (9 * K), sd, 3) - 0.5) * 0.22 + (vn2(x / (40 * K), y / (40 * K), sd + 9) - 0.5) * 0.1;
      const dome = (1 - Math.pow(Math.min(1, Math.abs(qx) / b.hx), 4)) * (1 - Math.pow(Math.min(1, Math.abs(qy) / b.hy), 4));
      hh = base + thick * Math.sqrt(sstep(0, 3.2 * K, -d)) + 1.5 * K * dome + (vn2(x / (1.3 * K), y / (1.3 * K), sd + 3) - 0.5) * 0.45 * K + f * 1.4 * K;
      m = clamp(1 + mot + f, 0.6, 1.5);
      const hue = (vn2(x / (16 * K), y / (16 * K), sd + 5) - 0.5) * 0.08;
      const v = clamp(1 - 0.18 * sstep(0, 1.8 * K, d + 1.8 * K) , 0, 1);
      R[i] += (col[0] * m * (1 + hue) * v - R[i]) * a; G[i] += (col[1] * m * v - G[i]) * a; B[i] += (col[2] * m * (1 - hue) * v - B[i]) * a;
    } else {
      const u = (qx * ca + qy * sa) / lp, v = (-qx * sa + qy * ca) / lp, iu = Math.round(u), iv = Math.round(v), du = u - iu, dv = v - iv;
      const wu = 0.4 + 0.06 * (vn1(sd + iu * 31, v / 3) - 0.5), wv = 0.4 + 0.06 * (vn1(sd + 7 + iv * 31, u / 3) - 0.5);
      const pu = Math.abs(du) < wu ? Math.sqrt(1 - (du / wu) ** 2) : -1, pv = Math.abs(dv) < wv ? Math.sqrt(1 - (dv / wv) ** 2) : -1;
      const au = pu >= 0 ? 0.55 * K * pu + 0.35 * K * Math.cos(PI * v + PI * iu) : -9, av = pv >= 0 ? 0.55 * K * pv - 0.35 * K * Math.cos(PI * u + PI * iv) : -9;
      const top = Math.max(au, av), pr = au > av ? pu : pv, tn = au > av ? vn1(sd + 3 + iu * 17, v / 0.8) : vn1(sd + 5 + iv * 17, u / 0.8);
      hh = base + thick * Math.sqrt(sstep(0, 1.6 * K, -d)) + (top < -5 ? -0.3 * K : top);
      m = top < -5 ? 0.62 : (0.86 + 0.14 * pr) * (0.92 + 0.16 * tn);
      sp = 0.05 * Math.max(0, pr);
      R[i] += (col[0] * m - R[i]) * a; G[i] += (col[1] * m - G[i]) * a; B[i] += (col[2] * m - B[i]) * a;
    }
    H[i] += (hh - H[i]) * a; S[i] += (sp - S[i]) * a;
  }
}

function hull(ts, hs) {
  const n = ts.length, st = [];
  for (let k = 0; k < n; k++) { while (st.length >= 2) { const a = st[st.length - 2], b = st[st.length - 1]; if ((hs[b] - hs[a]) * (ts[k] - ts[a]) - (hs[k] - hs[a]) * (ts[b] - ts[a]) <= 0) st.pop(); else break; } st.push(k); }
  const out = new Float32Array(n); let j = 0;
  for (let k = 0; k < n; k++) { while (j < st.length - 2 && ts[st[j + 1]] < ts[k]) j++; const a = st[j], b = st[Math.min(j + 1, st.length - 1)]; out[k] = a === b ? hs[a] : hs[a] + (hs[b] - hs[a]) * (ts[k] - ts[a]) / (ts[b] - ts[a]); }
  return out;
}
function profile(C, s) {
  const { w, h, H } = C, dx = s.bx - s.ax, dy = s.by - s.ay, len = Math.hypot(dx, dy) || 0.01, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const n = Math.max(3, Math.ceil(len / (0.75 * K)) + 1), ts = new Float32Array(n), hs = new Float32Array(n), side = s.w * 0.32;
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * len; ts[k] = t; let m = -1e9;
    for (const o of [-side, 0, side]) { const x = Math.round(s.ax + ux * t + nx * o - 0.5), y = Math.round(s.ay + uy * t + ny * o - 0.5); if (x >= 0 && y >= 0 && x < w && y < h) m = Math.max(m, H[y * w + x]); }
    hs[k] = m < -1e8 ? 0 : m;
  }
  s.prof = hull(ts, hs); s.len = len;
}
function drawStitch(C, s) {
  const { w: CW, h: CHh, H, R, G, B, S } = C, th = s.th;
  const dx = s.bx - s.ax, dy = s.by - s.ay, len = Math.hypot(dx, dy) || 0.01, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const hw0 = s.w / 2, rad = s.w * (s.flat ?? 0.42), capR = (s.cap ?? 0.33) * s.w, tp = s.taper ?? 0.6, prof = s.prof, pn = prof.length, pstep = len / (pn - 1);
  const pitch = s.w * (s.pitch ?? 1.3), slant = s.slant ?? 0.5, nply = s.plies ?? th.plies, gn = s.grain ?? 0.06, col = th.col, pale = th.pale, ph0 = s.phase ?? 0, hump = s.hump || 0, spec = th.spec;
  const x0 = Math.max(0, Math.floor(Math.min(s.ax, s.bx) - hw0 - 2)), x1 = Math.min(CW - 1, Math.ceil(Math.max(s.ax, s.bx) + hw0 + 2));
  const y0 = Math.max(0, Math.floor(Math.min(s.ay, s.by) - hw0 - 2)), y1 = Math.min(CHh - 1, Math.ceil(Math.max(s.ay, s.by) + hw0 + 2));
  const gs = s.seed | 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5 - s.ax, py = y + 0.5 - s.ay, t = px * ux + py * uy, v = px * nx + py * ny, e = Math.min(t, len - t);
    let hw;
    if (e >= 0) hw = hw0 * (tp + (1 - tp) * sstep(0, 0.85 * s.w, e));
    else { const q = capR * capR - e * e; if (q <= 0) continue; hw = Math.sqrt(q); }
    const av = v < 0 ? -v : v; if (av > hw + 0.5) continue;
    const a = Math.min(1, hw + 0.5 - av), u = clamp(v / hw, -1, 1), tc = clamp(t, 0, len);
    const fi = tc / pstep, i0 = Math.min(pn - 2, Math.floor(fi)), base = prof[i0] + (prof[i0 + 1] - prof[i0]) * (fi - i0);
    const dive = (s.dive ?? 0.45) + (1 - (s.dive ?? 0.45)) * sstep(-0.1 * s.w, 0.75 * s.w, e);
    const ph = t / pitch + u * slant + ph0, pf = ph * nply, q = pf - Math.floor(pf), ply = ((Math.floor(pf) % nply) + nply) % nply, groove = 1 - Math.sin(PI * q), gd = s.groove ?? 0.17;
    const hp = hump ? hump * 4 * (tc / len) * (1 - tc / len) : 0;
    const hh = base + rad * Math.sqrt(1 - u * u) * dive - gd * rad * groove + hp;
    const i = y * CW + x;
    if (hh <= H[i] + 0.05) continue;
    H[i] += (hh - H[i]) * a;
    const c = pale && ply === 0 ? pale : col, gr = 1 - gn + 2 * gn * hash(x, y, gs);
    const sh = (0.8 + 0.2 * sstep(-0.1 * s.w, 0.7 * s.w, e)) * (1 - 0.12 * groove) * gr;
    R[i] += (c[0] * sh - R[i]) * a; G[i] += (c[1] * sh - G[i]) * a; B[i] += (c[2] * sh - B[i]) * a; S[i] += (spec - S[i]) * a;
  }
}
function sew(C, list) { for (const s of list) profile(C, s); for (const s of list) drawStitch(C, s); }

function satin(C, b, o) {
  const pts = rrPath(b, o.wob, 0.5), n = pts.length, half = o.bw / 2, r = rng('satin:' + o.seed), out = [];
  const outer = pts.map(([x, y, nx, ny]) => [x + nx * (half - o.inset), y + ny * (half - o.inset)]), cum = [0];
  for (let i = 1; i <= n; i++) { const a = outer[i - 1], c = outer[i % n]; cum.push(cum[i - 1] + Math.hypot(c[0] - a[0], c[1] - a[1])); }
  const L = cum[n], m = Math.round(L / o.sp);
  let j = 0;
  for (let k = 0; k < m; k++) {
    const s = (k + 0.5 + r.gauss(0, 0.08)) * (L / m);
    while (j < n - 1 && cum[j + 1] < s) j++;
    const [x, y, nx, ny] = pts[j], tx = -ny, ty = nx, sl = o.slant + r.gauss(0, 0.04), bwn = 1 + 0.07 * (vn1(o.seed.length * 977 + 3, s / (14 * K)) - 0.5) * 2;
    const dx = nx * Math.cos(sl) + tx * Math.sin(sl), dy = ny * Math.cos(sl) + ty * Math.sin(sl);
    const cx = x - nx * o.inset, cy = y - ny * o.inset, h1 = half * bwn + r.gauss(0, 0.13 * K), h0 = half * bwn + r.gauss(0, 0.13 * K);
    out.push({ ax: cx - dx * h0, ay: cy - dy * h0, bx: cx + dx * h1, by: cy + dy * h1, w: o.tw, th: o.th, hump: o.hump, seed: k * 7 + 1, phase: r(), pitch: 6, slant: 0.5, plies: 6, grain: 0.025, groove: 0.09, flat: 0.46 });
  }
  sew(C, out);
}

function chamfer(B, w, h) {
  const D = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) D[i] = B[i] ? 1e9 : 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (D[i]) D[i] = Math.min(D[i], D[i - 1] + 1, D[i - w] + 1, D[i - w - 1] + 1.4142, D[i - w + 1] + 1.4142); }
  for (let y = h - 2; y > 0; y--) for (let x = w - 2; x > 0; x--) { const i = y * w + x; if (D[i]) D[i] = Math.min(D[i], D[i + 1] + 1, D[i + w] + 1, D[i + w + 1] + 1.4142, D[i + w - 1] + 1.4142); }
  return D;
}
function thin(B, w, h) {
  const del = [];
  for (let changed = true; changed;) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (!B[i]) continue;
        const p2 = B[i - w], p3 = B[i - w + 1], p4 = B[i + 1], p5 = B[i + w + 1], p6 = B[i + w], p7 = B[i + w - 1], p8 = B[i - 1], p9 = B[i - w - 1];
        const bs = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (bs < 2 || bs > 6) continue;
        const tr = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2); if (tr !== 1) continue;
        if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
        del.push(i);
      }
      if (del.length) { changed = true; for (const i of del) B[i] = 0; }
    }
  }
}
function traceSk(B, w, h) {
  const px = []; for (let i = 0; i < w * h; i++) if (B[i]) px.push(i);
  const NB = new Map();
  for (const i of px) {
    const N = B[i - w], S2 = B[i + w], E = B[i + 1], Wd = B[i - 1], o = [];
    if (N) o.push(i - w); if (S2) o.push(i + w); if (E) o.push(i + 1); if (Wd) o.push(i - 1);
    if (B[i - w + 1] && !N && !E) o.push(i - w + 1); if (B[i - w - 1] && !N && !Wd) o.push(i - w - 1);
    if (B[i + w + 1] && !S2 && !E) o.push(i + w + 1); if (B[i + w - 1] && !S2 && !Wd) o.push(i + w - 1);
    NB.set(i, o);
  }
  const used = new Set(), key = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a), deg = (i) => NB.get(i).length, paths = [];
  const walk = (a, b) => { const pts = [a, b]; used.add(key(a, b)); let prev = a, cur = b; while (deg(cur) === 2) { const nx = NB.get(cur).find((q) => q !== prev && !used.has(key(cur, q))); if (nx === undefined) break; used.add(key(cur, nx)); pts.push(nx); prev = cur; cur = nx; } return pts; };
  for (const i of px) if (deg(i) !== 2) for (const q of NB.get(i)) if (!used.has(key(i, q))) paths.push(walk(i, q));
  for (const i of px) if (deg(i) === 2) for (const q of NB.get(i)) if (!used.has(key(i, q))) paths.push(walk(i, q));
  return { paths, dots: px.filter((i) => deg(i) === 0), deg };
}

const SKC = new Map();
function skeleton(text, size) {
  const kk = text + '|' + size; if (SKC.has(kk)) return SKC.get(kk);
  const em = 160, sc = em / size, font = `${em}px "${FACE}"`;
  probe.font = font; const tw0 = probe.measureText(text).width;
  const pad = 40, cw = Math.ceil(tw0 + 2 * pad), ch = Math.ceil(em * 1.45 + 2 * pad), base = Math.round(pad + em * 1.0);
  const c = createCanvas(cw, ch), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch); g.fillStyle = '#fff'; g.font = font; g.textBaseline = 'alphabetic'; g.fillText(text, pad, base);
  const d = g.getImageData(0, 0, cw, ch).data, Bm = new Uint8Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) Bm[i] = d[4 * i] > 127 ? 1 : 0;
  const DT = chamfer(Bm, cw, ch), blobs = [], lab = new Int32Array(cw * ch), stack = [];
  for (let i0 = 0; i0 < cw * ch; i0++) {
    if (!Bm[i0] || lab[i0]) continue;
    const id = blobs.length + 1, px = []; lab[i0] = id; stack.push(i0);
    while (stack.length) { const i = stack.pop(); px.push(i); for (const q of [i - 1, i + 1, i - cw, i + cw, i - cw - 1, i - cw + 1, i + cw - 1, i + cw + 1]) if (Bm[q] && !lab[q]) { lab[q] = id; stack.push(q); } }
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, sx = 0, sy = 0;
    for (const i of px) { const x = i % cw, y = (i / cw) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); sx += x; sy += y; }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, st = em * 0.1;
    if (Math.max(bw, bh) <= 2.2 * st && Math.max(bw, bh) / Math.min(bw, bh) < 1.45) { blobs.push([(sx / px.length + 0.5 - pad) / sc, (sy / px.length + 0.5 - base) / sc, Math.sqrt(px.length / PI) / sc]); for (const i of px) Bm[i] = 0; }
    else blobs.push(null);
  }
  thin(Bm, cw, ch);
  const { paths, dots: dots0, deg } = traceSk(Bm, cw, ch), dots = [];
  const dts = []; for (const p of paths) for (const i of p) dts.push(DT[i]); dts.sort((a, b) => a - b);
  const strokePx = 2 * (dts[dts.length >> 1] || 6), spur = strokePx * 0.75;
  const toPt = (i) => [((i % cw) + 0.5 - pad) / sc, (((i / cw) | 0) + 0.5 - base) / sc, DT[i] / sc];
  const out = [];
  for (const p of paths) {
    const a = p[0], b = p[p.length - 1], closed = a === b && p.length > 3;
    const free0 = deg(a) === 1, free1 = deg(b) === 1;
    if (!closed && p.length < spur && ((free0 && deg(b) >= 3) || (free1 && deg(a) >= 3))) continue;
    if (!closed && p.length < 3 && !free0 && !free1) continue;
    let pts = p.map(toPt);
    for (let it = 0; it < 3; it++) {
      const q = pts.map((v) => v.slice());
      for (let k = 0; k < pts.length; k++) {
        if (!closed && (k === 0 || k === pts.length - 1)) continue;
        const A = pts[closed ? (k - 1 + pts.length) % pts.length : k - 1], Bp = pts[closed ? (k + 1) % pts.length : k + 1];
        q[k][0] = 0.25 * A[0] + 0.5 * pts[k][0] + 0.25 * Bp[0]; q[k][1] = 0.25 * A[1] + 0.5 * pts[k][1] + 0.25 * Bp[1];
      }
      pts = q;
    }
    out.push({ pts, closed, free0, free1 });
  }
  const res = { paths: out, dots: dots0.map(toPt).concat(blobs.filter(Boolean)), stroke: strokePx / sc, width: tw0 / sc };
  SKC.set(kk, res);
  return res;
}

function resampleLin(pts, step) { const out = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } out.push(pts[pts.length - 1].slice()); return out; }
function arcAt(P, cum, s) { let k = 1; while (k < P.length - 1 && cum[k] < s) k++; const t = (s - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1); return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t, (P[k - 1][2] ?? 0) + ((P[k][2] ?? 0) - (P[k - 1][2] ?? 0)) * t]; }
function cumOf(P) { const c = [0]; for (let i = 1; i < P.length; i++) c.push(c[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return c; }
function devOf(P, cum, s0, s1) { const a = arcAt(P, cum, s0), b = arcAt(P, cum, s1), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6; let m = 0; for (let k = 0; k < P.length; k++) { if (cum[k] <= s0 || cum[k] >= s1) continue; const d = Math.abs((P[k][0] - a[0]) * (b[1] - a[1]) - (P[k][1] - a[1]) * (b[0] - a[0])) / L; if (d > m) m = d; } return m; }

function letterStitches(text, size, x, baseline, o) {
  const sk = skeleton(text, size), out = [], r = rng('letters:' + text + x + baseline);
  const tw = (o.w ?? sk.stroke * (o.wk ?? 1.08)) * K, txt = { taper: 0.78, dive: 0.62, cap: 0.42 };
  for (const p of sk.paths) {
    let P = p.pts.map(([px, py, hw]) => [(x + px) * K, (baseline + py) * K, hw * K]);
    if (o.style === 'satin') {
      const ext = (Q, end) => { const a = end ? Q[Q.length - 1] : Q[0], b = end ? Q[Math.max(0, Q.length - 4)] : Q[Math.min(Q.length - 1, 3)], L = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, dx = (a[0] - b[0]) / L, dy = (a[1] - b[1]) / L, ex = []; for (let k = 1; k <= 4; k++) { const e = (k / 4) * a[2] * 0.92; ex.push([a[0] + dx * e, a[1] + dy * e, Math.sqrt(Math.max(0, a[2] * a[2] - e * e)) + 0.2 * K]); } return ex; };
      if (!p.closed && P.length > 1) { if (p.free0) P = ext(P, false).reverse().concat(P); if (p.free1) P = P.concat(ext(P, true)); }
      if (p.closed) P = P.concat([P[0]]);
      const cum = cumOf(P), L = cum[cum.length - 1], n = Math.max(1, Math.round(L / o.sp));
      for (let k = 0; k <= n; k++) {
        const s = (k / n) * L, c = arcAt(P, cum, s), c0 = arcAt(P, cum, Math.max(0, s - 1.5 * K)), c1 = arcAt(P, cum, Math.min(L, s + 1.5 * K));
        let tx = c1[0] - c0[0], ty = c1[1] - c0[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const sl = o.slant, nx = -ty * Math.cos(sl) + tx * Math.sin(sl), ny = tx * Math.cos(sl) + ty * Math.sin(sl), hw = c[2] + (o.over ?? 0.35) * K;
        if (hw < 0.6 * K) continue;
        out.push({ ax: c[0] - nx * hw, ay: c[1] - ny * hw, bx: c[0] + nx * hw, by: c[1] + ny * hw, w: o.tw * K, th: o.th, hump: (o.hump ?? 0) * K, seed: k, phase: r(), pitch: 6, slant: 0.5, flat: 0.4, plies: 6, grain: 0.025, groove: 0.09 });
      }
      continue;
    }
    if (p.closed) P = P.concat([P[0]]);
    const cum = cumOf(P), L = cum[cum.length - 1];
    if (L < 0.6 * K) { const c = P[0]; out.push({ ax: c[0] - 0.3 * tw, ay: c[1], bx: c[0] + 0.3 * tw, by: c[1], w: tw, th: o.th, seed: 3 }); continue; }
    const Ls = (o.len ?? 3.0) * tw, segs = [];
    const split = (s0, s1, depth) => { if (depth < 5 && s1 - s0 > 0.9 * tw && devOf(P, cum, s0, s1) > (o.tol ?? 0.22) * tw) { const m = (s0 + s1) / 2; split(s0, m, depth + 1); split(m, s1, depth + 1); } else segs.push([s0, s1]); };
    const n = Math.max(1, Math.round(L / Ls)); for (let k = 0; k < n; k++) split((k / n) * L, ((k + 1) / n) * L, 0);
    segs.forEach(([s0, s1], k) => {
      const ov = k || p.closed ? (s1 - s0) * 0.22 : 0, a = arcAt(P, cum, Math.max(0, s0 - ov)), b = arcAt(P, cum, s1);
      out.push({ ax: a[0] + r.gauss(0, 0.04 * K), ay: a[1] + r.gauss(0, 0.04 * K), bx: b[0], by: b[1], w: tw * (1 + r.gauss(0, 0.03)), th: o.th, seed: k * 13 + 5, phase: r(), pitch: 1.2, slant: 0.55, ...txt });
    });
  }
  for (const [dx, dy, dr] of sk.dots) { const cx = (x + dx) * K, cy = (baseline + dy) * K, rr = Math.max(0.3 * tw, (dr * K - 0.5 * tw) * 0.9); for (const an of [0.35, 1.45]) out.push({ ax: cx - Math.cos(an) * rr, ay: cy - Math.sin(an) * rr, bx: cx + Math.cos(an) * rr, by: cy + Math.sin(an) * rr, w: tw * 1.08, th: o.th, seed: 9, phase: r(), taper: 0.85, dive: 0.7, cap: 0.5 }); }
  return out;
}

function stitchText(C, text, size, x, baseline, o) { sew(C, letterStitches(text, size, x, baseline, o)); }
function stitchLines(C, lines, size, box, align, o, lp = LP) {
  const all = [];
  lines.forEach((t, i) => {
    const w = textW(t, size), bl = box.y0 + size * 0.8 + i * size * lp, x = align === 'left' ? box.x0 : align === 'right' ? box.x1 - w : (box.x0 + box.x1) / 2 - w / 2;
    all.push(...letterStitches(t, size, x, bl, o));
  });
  sew(C, all);
}

function running(C, ptsF, o) {
  const P0 = smoothPath(ptsF, 1).map(([x, y]) => [x * K, y * K]), cum0 = cumOf(P0), L0 = cum0[cum0.length - 1], ws = (rng('wob:' + (o.seed || ''))() * 1e9) | 0, amp = (o.wob ?? 0.75) * K;
  const P = P0.map((p, i) => { const a = P0[Math.max(0, i - 1)], b = P0[Math.min(P0.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, s = cum0[i], d = amp * (vn1(ws, s / (34 * K)) - 0.5) * 2 * sstep(0, 22 * K, s) * sstep(0, 22 * K, L0 - s); return [p[0] - (dy / l) * d, p[1] + (dx / l) * d]; });
  const cum = cumOf(P), L = cum[cum.length - 1], r = rng('run:' + (o.seed || '') + P[0][0] + P[0][1]);
  const tw = o.w * K, D = o.dash * K, Gp = o.gap * K, endGap = o.head ? (o.endGap ?? 6) * K : 0, startGap = (o.startGap ?? 0) * K;
  const usable = L - endGap - startGap, n = Math.max(1, Math.round((usable + Gp) / (D + Gp))), f = usable / (n * D + (n - 1) * Gp), out = [];
  for (let k = 0; k < n; k++) {
    const s0 = startGap + k * (D + Gp) * f + (k ? r.gauss(0, 0.06 * D) : 0), s1 = startGap + (k * (D + Gp) + D) * f + (k < n - 1 ? r.gauss(0, 0.06 * D) : 0);
    const a = arcAt(P, cum, clamp(s0, 0, L)), b = arcAt(P, cum, clamp(s1, 0, L)), j = r.gauss(0, 0.05 * K);
    out.push({ ax: a[0] + j, ay: a[1] + r.gauss(0, 0.05 * K), bx: b[0] + r.gauss(0, 0.05 * K), by: b[1] + r.gauss(0, 0.05 * K), w: tw * (1 + r.gauss(0, 0.035)), th: o.th, seed: k, phase: r(), pitch: 1.3, slant: 0.5, flat: o.flat, taper: o.taper });
  }
  if (o.head) {
    const tip = P[P.length - 1], q = arcAt(P, cum, Math.max(0, L - 10 * K)), an = Math.atan2(tip[1] - q[1], tip[0] - q[0]), hl = (o.headLen ?? 15) * K, ha = o.headAng ?? 0.6;
    for (const sg of [-1, 1]) { const a2 = an + PI - sg * ha; out.push({ ax: tip[0] + Math.cos(a2) * hl, ay: tip[1] + Math.sin(a2) * hl, bx: tip[0], by: tip[1], w: tw, th: o.th, seed: 77 + sg, phase: r(), pitch: 1.3, slant: 0.5, flat: o.flat, taper: o.taper }); }
  }
  sew(C, out);
  return out;
}

function chainLine(C, ptsF, o) {
  const P = resampleLin(ptsF, 1).map(([x, y]) => [x * K, y * K]), cum = cumOf(P), L = cum[cum.length - 1], r = rng('chain:' + P[0][0] + P[0][1]), n = Math.max(1, Math.round(L / (o.len * K))), out = [], tw = o.w * K;
  for (let k = 0; k < n; k++) {
    const s0 = (k / n) * L, s1 = ((k + 1) / n) * L, a = arcAt(P, cum, s0), b = arcAt(P, cum, s1), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const bulge = (o.bulge ?? 0.3) * l * (1 + r.gauss(0, 0.06)), back = 0.18 * l;
    for (const sg of [-1, 1]) {
      let prev = [a[0] + (dx / l) * back * 0.4, a[1] + (dy / l) * back * 0.4];
      for (let j = 1; j <= 4; j++) {
        const t = j / 4, off = sg * bulge * Math.sin(PI * Math.pow(t, 0.78)) * (j === 4 ? 0.15 : 1), q = [a[0] + dx * (t * 1.08) + nx * off, a[1] + dy * (t * 1.08) + ny * off];
        out.push({ ax: prev[0], ay: prev[1], bx: q[0], by: q[1], w: tw, th: o.th, seed: k * 9 + j, phase: r(), pitch: 1.2, slant: 0.5, taper: j === 1 ? 0.7 : 0.92, dive: j === 1 ? 0.5 : 0.85, cap: 0.48 });
        prev = q;
      }
    }
  }
  sew(C, out);
}

function knot(C, cxF, cyF, rF, th, seed) {
  const cx = cxF * K, cy = cyF * K, rr = rF * K, rnd = rng('knot:' + seed), tw = rr * 0.56;
  const ring = (rad, n, a0, wmul) => { const out = []; for (let k = 0; k < n; k++) { const a1 = a0 + (k / n) * PI * 2, a2 = a0 + ((k + 1.25) / n) * PI * 2, j = 1 + rnd.gauss(0, 0.05); out.push({ ax: cx + Math.cos(a1) * rad * j, ay: cy + Math.sin(a1) * rad * j, bx: cx + Math.cos(a2) * rad, by: cy + Math.sin(a2) * rad, w: tw * wmul, th, seed: k, phase: rnd(), pitch: 1.1, slant: 0.6, taper: 0.8, dive: 0.75, cap: 0.5, flat: 0.55 }); } return out; };
  sew(C, ring(rr * 0.6, 7, rnd() * 6, 1));
  sew(C, ring(rr * 0.3, 4, rnd() * 6, 0.95));
  const a = rnd() * PI;
  sew(C, [{ ax: cx - Math.cos(a) * rr * 0.32, ay: cy - Math.sin(a) * rr * 0.32, bx: cx + Math.cos(a) * rr * 0.32, by: cy + Math.sin(a) * rr * 0.32, w: tw, th, seed: 99, phase: rnd(), pitch: 1.1, slant: 0.6, taper: 0.85, dive: 0.7, cap: 0.5, flat: 0.55 }]);
}

function cordFrame(C, x0, y0, x1, y1, rad, o) {
  const pts = [], arc = (cx, cy, a0) => { for (let k = 0; k < 12; k++) { const a = a0 + (k / 12) * PI / 2; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } };
  pts.push([x0 + rad, y0]); pts.push([x1 - rad, y0]); arc(x1 - rad, y0 + rad, -PI / 2); pts.push([x1, y0 + rad]); pts.push([x1, y1 - rad]); arc(x1 - rad, y1 - rad, 0);
  pts.push([x1 - rad, y1]); pts.push([x0 + rad, y1]); arc(x0 + rad, y1 - rad, PI / 2); pts.push([x0, y1 - rad]); pts.push([x0, y0 + rad]); arc(x0 + rad, y0 + rad, PI); pts.push([x0 + rad, y0]);
  const ws = 4242, P0 = resampleLin(pts, 1), c0 = cumOf(P0);
  const P = P0.map((p, i) => { const a = P0[Math.max(0, i - 1)], b = P0[Math.min(P0.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, d = 0.7 * (vn1(ws, c0[i] / 40) - 0.5) * 2; return [(p[0] - (dy / l) * d) * K, (p[1] + (dx / l) * d) * K]; });
  const cum = cumOf(P), L = cum[cum.length - 1], cw = o.w * K, seg = 2.6 * cw, n = Math.round(L / seg), out = [], tacks = [], r = rng('cord');
  for (let k = 0; k < n; k++) {
    const s0 = (k / n) * L - 0.35 * seg, s1 = ((k + 1) / n) * L, a = arcAt(P, cum, (s0 + L) % L), b = arcAt(P, cum, s1 % L === 0 && k === n - 1 ? L : s1);
    out.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], w: cw, th: o.th, seed: k, phase: s0 / (cw * 0.95), pitch: 0.95, slant: 0.95, taper: 1, dive: 0.92, cap: 0.5, flat: 0.46, groove: 0.34 });
  }
  sew(C, out);
  const tn = Math.round(L / (o.tack * K));
  for (let k = 0; k < tn; k++) {
    const s = ((k + 0.5) / tn) * L, c = arcAt(P, cum, s), c2 = arcAt(P, cum, Math.min(L, s + 2 * K)), dx = c2[0] - c[0], dy = c2[1] - c[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, h = (o.w / 2 + 1.6) * K, sk = r.gauss(0, 0.06);
    tacks.push({ ax: c[0] - (nx - sk * ny) * h, ay: c[1] - (ny + sk * nx) * h, bx: c[0] + (nx + sk * ny) * h, by: c[1] + (ny - sk * nx) * h, w: o.tw * K, th: o.tackTh, seed: k, phase: r(), pitch: 1.2, slant: 0.5 });
  }
  sew(C, tacks);
}

function boxBlur(src, w, h, r) {
  const a = new Float32Array(w * h), b = new Float32Array(w * h), k = 1 / (2 * r + 1);
  const pass = (s, d, horiz) => {
    const n = horiz ? w : h, lines = horiz ? h : w;
    for (let l = 0; l < lines; l++) {
      const at = (i) => (horiz ? s[l * w + clamp(i, 0, n - 1)] : s[clamp(i, 0, n - 1) * w + l]);
      let acc = 0; for (let i = -r; i <= r; i++) acc += at(i);
      for (let i = 0; i < n; i++) { if (horiz) d[l * w + i] = acc * k; else d[i * w + l] = acc * k; acc += at(i + r + 1) - at(i - r); }
    }
  };
  pass(src, a, true); pass(a, b, false); pass(b, a, true); pass(a, b, false);
  return b;
}

function shade(C) {
  const { w, h, H, R, G, B, S } = C, n = w * h;
  const b1 = boxBlur(H, w, h, Math.max(1, Math.round(1.6 * K))), b2 = boxBlur(H, w, h, Math.round(6 * K));
  const el = Number(ARG('el', 32)) * PI / 180, az = Number(ARG('az', 230)) * PI / 180, Lx = Math.cos(el) * Math.cos(az), Ly = Math.cos(el) * Math.sin(az), Lz = Math.sin(el);
  const hz = Lz + 1, hn = Math.hypot(Lx, Ly, hz), Hx = Lx / hn, Hy = Ly / hn, Hz = hz / hn;
  const dxy = Math.hypot(Lx, Ly), sx = Lx / dxy, sy = Ly / dxy, tanEl = Lz / dxy, SM = Math.round(13 * K), ox = new Int32Array(SM), oy = new Int32Array(SM), od = new Float32Array(SM);
  for (let s = 0; s < SM; s++) { ox[s] = Math.round(sx * (s + 1)); oy[s] = Math.round(sy * (s + 1)); od[s] = Math.hypot(ox[s], oy[s]); }
  const amb = 0.34, key = 0.66, ambC = [0.9, 0.94, 1.16], keyC = [1.08, 0.99, 0.9], spC = [1.0, 0.95, 0.86];
  const out = new Float32Array(n * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, h0 = H[i];
    const nx0 = (H[x > 0 ? i - 1 : i] - H[x < w - 1 ? i + 1 : i]) * 0.5, ny0 = (H[y > 0 ? i - w : i] - H[y < h - 1 ? i + w : i]) * 0.5, nl = Math.sqrt(nx0 * nx0 + ny0 * ny0 + 1);
    const nx = nx0 / nl, ny = ny0 / nl, nz = 1 / nl, ndl = Math.max(0, nx * Lx + ny * Ly + nz * Lz) / Lz;
    let occ = 0;
    for (let s = 0; s < SM; s++) { const qx = x + ox[s], qy = y + oy[s]; if (qx < 0 || qy < 0 || qx >= w || qy >= h) break; const dh = H[qy * w + qx] - h0 - od[s] * tanEl; if (dh > 0) { const v = dh / (0.3 * K + 0.3 * od[s]); if (v > occ) occ = v; } }
    const sh = 1 - Math.min(1, occ) * 0.92;
    const ao = 1 - Math.min(0.55, Math.max(0, b1[i] - h0) * 0.07 / K + Math.max(0, b2[i] - h0) * 0.028 / K);
    const ndh = Math.max(0, nx * Hx + ny * Hy + nz * Hz), sp = S[i] * Math.pow(ndh, 26) * sh;
    const lit = key * Math.min(1.7, ndl) * sh;
    out[3 * i] = R[i] * (amb * ambC[0] * ao + lit * keyC[0]) + sp * spC[0];
    out[3 * i + 1] = G[i] * (amb * ambC[1] * ao + lit * keyC[1]) + sp * spC[1];
    out[3 * i + 2] = B[i] * (amb * ambC[2] * ao + lit * keyC[2]) + sp * spC[2];
  }
  return out;
}

const VG = Number(ARG('vg', 0.24));
function toCanvas(C, lit, Wf, Hf) {
  const img = new Uint8ClampedArray(Wf * Hf * 4), w = C.w, kk = 1 / (K * K);
  for (let y = 0; y < Hf; y++) for (let x = 0; x < Wf; x++) {
    let r = 0, g = 0, b = 0;
    for (let yy = 0; yy < K; yy++) for (let xx = 0; xx < K; xx++) { const i = 3 * ((y * K + yy) * w + x * K + xx); r += lit[i]; g += lit[i + 1]; b += lit[i + 2]; }
    const vx = x / Wf - 0.44, vy = y / Hf - 0.34, rr2 = vx * vx * 1.3 + vy * vy, v = 1.06 - VG * rr2, vr = v + 0.05 * rr2 * VG / 0.16, vb = v + 0.035 * rr2 * VG / 0.16;
    const j = 4 * (y * Wf + x);
    img[j] = 255 * Math.pow(clamp(r * kk * vr, 0, 1), 1 / 2.2); img[j + 1] = 255 * Math.pow(clamp(g * kk * v, 0, 1), 1 / 2.2); img[j + 2] = 255 * Math.pow(clamp(b * kk * vb, 0, 1), 1 / 2.2); img[j + 3] = 255;
  }
  const c = createCanvas(Wf, Hf); c.getContext('2d').putImageData(new ImageData(img, Wf, Hf), 0, 0);
  return c;
}

function feltBox(b, inset) { return { cx: b.cx * K, cy: b.cy * K, hx: (b.w / 2 - inset) * K, hy: (b.h / 2 - inset) * K, r: 9 * K }; }

async function render(L, R, LB) {
  const t0 = Date.now(), Wf = L.W, Hf = L.H, C = cloth(Wf * K, Hf * K), log = (m) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', m);
  const linenC = lin(PAL.linen);
  weave(C, { pitch: 4.7 * K, thick: 0.74 * K, arc: 0.44 * K, color: mixc(linenC, lin('#c6ae88'), 0.62), seed: 'ground' });
  log('linen');
  cordFrame(C, 24, 24, Wf - 24, Hf - 24, 20, { w: 6.4, th: { ...TH.oldGold, plies: 3 }, tack: 23, tw: 1.7, tackTh: TH.ink });
  log('cord');
  const FB = 1.35 * K, OV = 4.3;
  const looks = {
    path: { kind: 'felt', color: lin(PAL.navy), thick: 5.4 * K, edge: TH.gold, text: TH.cream },
    side: { kind: 'linen', color: linenC, thick: 1.5 * K, edge: TH.slate, text: TH.ink },
    breaks: { kind: 'felt', color: lin(PAL.rust), thick: 5.4 * K, edge: TH.red, text: TH.cream },
  };
  for (const s of STATES) {
    const b = L.P[s.id], lk = looks[s.kind], fb = feltBox(b, OV), wob = wobbler(s.id, 0.6 * K), rr = rng('place:' + s.id);
    fb.rot = rr.gauss(0, 0.007); fb.r = (8 + 3 * rr()) * K;
    const dye = 1 + rr.gauss(0, 0.035), tint = rr.gauss(0, 0.02);
    patch(C, fb, { kind: lk.kind, color: [lk.color[0] * dye * (1 + tint), lk.color[1] * dye, lk.color[2] * dye * (1 - tint)], thick: lk.thick, base: FB, wob, seed: s.id });
    satin(C, fb, { wob, bw: 11 * K, inset: 1.2 * K, sp: 2.5 * K, tw: 2.95 * K, th: lk.edge, hump: 1.3 * K, slant: 0.16, seed: s.id });
    const n = s.lines.length, all = [];
    s.lines.forEach((t, i) => { const w = textW(t, SZ.state), bl = b.cy + (i - (n - 1) / 2) * SZ.state * LP + SZ.state * 0.36; all.push(...letterStitches(t, SZ.state, b.cx - w / 2, bl, { th: lk.text })); });
    sew(C, all);
    if (BUG.has(s.id)) knot(C, b.x0 + 10.5, b.y0 + 10.5, 4.6, TH.knot, 'bug' + s.id);
  }
  log('patches');
  const F = L.F, fr = 14, frameLabel = 'At the same time', flx = F.x0 + 40, flw = textW(frameLabel, SZ.frame);
  const corner = (cx, cy, a0) => Array.from({ length: 7 }, (_, k) => { const a = a0 + (k / 6) * PI / 2; return [cx + Math.cos(a) * fr, cy + Math.sin(a) * fr]; });
  const framePts = [[flx + flw + 14, F.y0], [F.x1 - fr, F.y0], ...corner(F.x1 - fr, F.y0 + fr, -PI / 2).slice(1), [F.x1, F.y1 - fr], ...corner(F.x1 - fr, F.y1 - fr, 0).slice(1), [F.x0 + fr, F.y1], ...corner(F.x0 + fr, F.y1 - fr, PI / 2).slice(1), [F.x0, F.y0 + fr], ...corner(F.x0 + fr, F.y0 + fr, PI).slice(1), [flx - 14, F.y0]];
  chainLine(C, framePts, { w: 1.9, len: 8.5, th: TH.ink });
  stitchText(C, frameLabel, SZ.frame, flx, F.y0 + SZ.frame * 0.3, { th: TH.ink });
  for (const x of L.seps) running(C, [[x, F.y0 + 16], [x, F.y1 - 16]], { w: 2.4, dash: 10, gap: 8, th: TH.ink, seed: 'sep' + x, wob: 1.1 });
  for (const [r, name] of REGIONS) { const w = textW(name, SZ.region); stitchText(C, name, SZ.region, (L.col[r][0] + L.col[r][1]) / 2 - w / 2, F.y0 + 62, { th: TH.ink, style: 'satin', sp: 1.5, tw: 1.8, slant: 0.32, hump: 0.5 }); }
  for (const [first, x] of [['s0', L.X.b], ['s13', L.X.ship], ['s19', L.X.tower]]) {
    const ky = F.y0 + 104;
    knot(C, x, ky, 7.6, TH.oldGold, 'start' + first);
    running(C, [[x, ky + 12], [x, L.P[first].y0 - 13]], { ...RUN, th: RTH.gold, seed: 'start' + first, wob: 0 });
  }
  log('frame');
  for (const a of ARROWS) running(C, R[a.from + '>' + a.to], { ...RUN, th: RTH[a.thread], seed: a.from + a.to });
  log('arrows');
  for (const [k, b] of Object.entries(LB)) stitchLines(C, b.lines, SZ.label, b, b.align, { th: TH.ink });
  log('labels');
  const tw = textW('Catch', SZ.title);
  stitchText(C, 'Catch', SZ.title, W / 2 - tw / 2, 176, { th: TH.oldGold, style: 'satin', sp: 2.4, tw: 2.8, slant: 0.5, hump: 1.6, over: 0.35 });
  const sub = 'Starship’s booster flies home and is caught by its tower', sw = textW(sub, SZ.sub);
  stitchText(C, sub, SZ.sub, W / 2 - sw / 2, 226, { th: TH.ink });
  legend(C, L);
  log('title and legend');
  const lit = shade(C);
  log('light');
  return toCanvas(C, lit, Wf, Hf);
}

function legend(C, L) {
  const y1 = L.F.y1 + 58, y2 = y1 + 46, x0 = L.F.x0 + 24, sz = SZ.label;
  let x = x0;
  const item = (y, draw, text, gap = 44) => { const w = draw(x, y); stitchText(C, text, sz, x + w + 12, y + sz * 0.34, { th: TH.ink }); x += w + 12 + textW(text, sz) + gap; };
  const arrowS = (th) => (xx, y) => { running(C, [[xx, y], [xx + 64, y]], { ...RUN, th, seed: 'leg' + xx + y, wob: 0 }); return 64; };
  item(y1, arrowS(RTH.gold), 'the flight that works');
  item(y1, arrowS(RTH.grey), 'other steps');
  item(y1, (xx, y) => { knot(C, xx + 8, y, 7.6, TH.oldGold, 'legstart'); return 16; }, 'start');
  x = x0;
  item(y2, arrowS(RTH.red), 'where TLC’s path goes wrong when the go/no-go poll is skipped');
  item(y2, (xx, y) => { knot(C, xx + 5, y, 4.6, TH.brick, 'legbug'); return 10; }, 'a state on that path');
  item(y2, (xx, y) => {
    const b = { cx: xx + 22, cy: y, w: 44, h: 30 }, fb = feltBox(b, OV2), wob = wobbler('legend', 0.4 * K);
    fb.r = 7 * K;
    patch(C, fb, { kind: 'felt', color: lin(PAL.rust), thick: 4.6 * K, base: 1.35 * K, wob, seed: 'legend' });
    satin(C, fb, { wob, bw: 7 * K, inset: 0.8 * K, sp: 2.3 * K, tw: 2.7 * K, th: TH.red, hump: 0.8 * K, slant: 0.16, seed: 'legend' });
    return 44;
  }, 'a rule breaks here');
  const t = `Checked by TLC: ${COUNTS[0]} states, ${COUNTS[1]} steps`, tw2 = textW(t, sz);
  stitchText(C, t, sz, L.F.x1 - 24 - tw2, y1 + sz * 0.34, { th: TH.ink });
}
const OV2 = 3;

function matchChart() {
  const mmd = fs.readFileSync(path.join(ROOT, 'model', 'chart', 'chart.mmd'), 'utf8'), names = {}, edges = new Set(), bugs = new Set(), breaks = new Set();
  for (const line of mmd.split('\n').map((l) => l.trim())) {
    const st = line.match(/^(s\d+): (.+)$/); if (st) names[st[1]] = st[2];
    const e = line.match(/^(s\d+) --> (s\d+): (.+)$/); if (e) edges.add(`${e[1]}>${e[2]}>${e[3].replace(/ \[when .*\]$/, '')}`);
    const c = line.match(/^class (s\d+) (bugPath|breaks)$/); if (c) (c[2] === 'bugPath' ? bugs : breaks).add(c[1]);
  }
  const named = (set) => [...set].map((x) => x.replace(/s\d+/g, (id) => names[id])).sort().join('\n');
  const plain = (t) => t.replace(/’/g, "'");
  const mine = new Set(ARROWS.map((a) => `${S[a.from].name}>${S[a.to].name}>${plain(a.lines.join(' ')).replace(/ \[when .*\]$/, '')}`));
  const theirs = named(edges), ours = [...mine].sort().join('\n');
  if (theirs !== ours) throw new Error('the sampler arrows differ from chart.mmd:\n' + theirs + '\n---\n' + ours);
  if (named(bugs) !== [...BUG].map((id) => S[id].name).sort().join('\n')) throw new Error('the sampler bug path differs from chart.mmd');
  if (named(breaks) !== STATES.filter((s) => s.kind === 'breaks').map((s) => s.name).sort().join('\n')) throw new Error('the sampler breaking states differ from chart.mmd');
}

async function main() {
  matchChart();
  const L = layout(), R = routes(L), LB = labels(L, R);
  const issues = check(L, R, LB);
  console.log(`layout ${L.W}x${L.H}, ${issues.length} layout issues`);
  for (const i of issues) console.log('!', i);
  if (process.argv.includes('--wire')) return wire(L, R, LB);
  const canvas = await render(L, R, LB);
  const out = ARG('out', OUT_PNG);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, await canvas.encode('png'));
  const r4 = (b) => [Math.round(b.x0), Math.round(b.y0), Math.round(b.w), Math.round(b.h)];
  const F = L.F, edges = [F.x0, L.seps[0], L.seps[1], F.x1];
  const json = { width: L.W, height: L.H, states: Object.fromEntries(STATES.map((s) => [s.name, r4(L.P[s.id])])), regions: Object.fromEntries(REGIONS.map(([r, name], i) => [name, [Math.round(edges[i]), Math.round(F.y0), Math.round(edges[i + 1] - edges[i]), Math.round(F.y1 - F.y0)]])) };
  if (!ARG('out')) {
    const rows = (o) => Object.entries(o).map(([k, v]) => `    ${JSON.stringify(k)}: [${v.join(', ')}]`).join(',\n');
    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    fs.writeFileSync(OUT_JSON, `{\n  "width": ${json.width},\n  "height": ${json.height},\n  "states": {\n${rows(json.states)}\n  },\n  "regions": {\n${rows(json.regions)}\n  }\n}\n`);
  }
  console.log('wrote', out, L.W + 'x' + L.H);
}

main().catch((e) => { console.error(e); process.exit(1); });
