'use strict';
const path = require('path');
const fs = require('fs');
const M = require('./media');
const { D } = M;
const { rng } = require('../../tools/kit/util');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { createCanvas } = tools('@napi-rs/canvas');

const OUT = path.join(__dirname, '..', 'out', 'tex');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

const sheet = (id, w, h, px, paper) => M.sheet({ id: 'catch-' + id, w, h, ppm: px / w, paper, seed: 'catch-' + id });
const save = (P, name) => P.save(path.join(OUT, name + '.png'));

function steelBase(P, w, h, seed, q = {}) {
  const R = rng('steel:' + seed);
  for (let i = 0; i < (q.brush ?? 260); i++) {
    const x = R() * w, y0 = R() * h, l = 8 + R() * 40;
    P.line([[x, y0], [x + (R() - 0.5) * 0.6, y0 + l]], { tool: 'graphite', color: R() < 0.7 ? '#8e9396' : '#f4f6f6', pressure: 0.12 + R() * 0.18, tremor: 0.2 });
  }
  const ring = q.ring ?? 14;
  for (let y = q.ringStart ?? ring; y < h - 1; y += ring) {
    const pts = []; for (let x = -1; x <= w + 1; x += 3) pts.push([x, y + Math.sin(x * 0.08 + y) * 0.25]);
    P.line(pts, { tool: 'pencil', color: '#6d7376', pressure: 0.75, tremor: 0.3 });
    P.line(pts.map(([x, yy]) => [x, yy + 0.7]), { tool: 'pastelpencil', color: '#eef1f1', pressure: 0.5, tremor: 0.3 });
    const off = R() * w;
    for (let k = 0; k < 3; k++) { const x = (off + (k * w) / 3) % w; P.line([[x, y], [x, Math.min(h, y + ring)]], { tool: 'pencil', color: '#7f8588', pressure: 0.45, tremor: 0.25 }); }
  }
  P.line([[0.6, 0], [0.6, h]], { tool: 'pencil', color: '#5d6266', pressure: 0.9 });
  P.line([[w - 0.6, 0], [w - 0.6, h]], { tool: 'pencil', color: '#5d6266', pressure: 0.9 });
}

function tiles(P, x0, x1, y0, y1, seed, q = {}) {
  const R = rng('tiles:' + seed), s = q.size ?? 2.6, hx = s * Math.sqrt(3), wob = (y) => Math.sin(y * 0.09 + 1.3) * 2.2;
  const edge = (y, side) => (side < 0 ? x0 + wob(y) : x1 - wob(y + 40));
  for (let row = 0, y = y0; y < y1 + s; row++, y += s * 1.5) {
    for (let x = x0 - hx + (row % 2 ? hx / 2 : 0); x < x1 + hx; x += hx) {
      if (x < edge(y, -1) - (R() < 0.2 ? hx : 0) || x > edge(y, 1) + (R() < 0.2 ? hx : 0)) continue;
      const hex = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; hex.push([x + Math.cos(a) * s * 0.93, y + Math.sin(a) * s * 0.93]); }
      P.fill([hex], R() < 0.06 ? '#3a3a40' : '#232327', { tool: 'pencil', pressure: 0.98, passes: 2 });
      P.outline([hex], { color: '#4c4c54', nib: 0.16 });
    }
  }
}

const TEX = {
  booster: () => {
    const w = 89, h = 223, P = sheet('booster', w, h, 1024, { base: '#c4c9c8', tooth: 0.5, fibre: 0.45 });
    steelBase(P, w, h, 'booster', { ring: 5.9 });
    for (let i = 0; i < 5; i++) P.fill([[[0, h - 6 - i * 2.4], [w, h - 6 - i * 2.4], [w, h], [0, h]]], '#3f3b3a', { tool: 'graphite', pressure: 0.18, passes: 1, angle: 90 });
    for (const x of [w * 0.12, w * 0.37, w * 0.62, w * 0.87]) { P.line([[x, 3], [x, 30]], { tool: 'pencil', color: '#6a6f72', pressure: 0.6 }); }
    return save(P, 'booster');
  },
  ship: () => {
    const w = 89, h = 114, P = sheet('ship', w, h, 1024, { base: '#c8cccb', tooth: 0.5, fibre: 0.45 });
    steelBase(P, w, h, 'ship', { ring: 5.8, brush: 160 });
    tiles(P, w * 0.25, w * 0.75, -2, h + 2, 'ship');
    return save(P, 'ship');
  },
  nose: () => {
    const w = 89, h = 47, P = sheet('nose', w, h, 1024, { base: '#c8cccb', tooth: 0.5, fibre: 0.45 });
    steelBase(P, w, h, 'nose', { ring: 13, brush: 60 });
    tiles(P, w * 0.25, w * 0.75, -2, h + 2, 'nose');
    return save(P, 'nose');
  },
  balsa: () => {
    const w = 60, P = sheet('balsa', w, w, 512, { base: '#dcc39a', tooth: 0.4, fibre: 0.6 }), R = rng('balsa');
    for (let i = 0; i < 70; i++) { const x = R() * w, pts = []; for (let y = -1; y <= w + 1; y += 2) pts.push([x + Math.sin(y * 0.15 + i) * 0.5, y]); P.line(pts, { tool: 'pencil', color: R() < 0.5 ? '#a8865a' : '#c4a274', pressure: 0.3 + R() * 0.4, tremor: 0.3 }); }
    return save(P, 'balsa');
  },
  card: () => {
    const w = 60, P = sheet('card', w, w, 512, { base: '#5b5e63', tooth: 0.55, fibre: 0.5 }), R = rng('card');
    P.hatch([[[0, 0], [w, 0], [w, w], [0, w]]], '#3f4246', { angle: 38, pitch: 1.4, nib: 0.2, length: 30 });
    for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * w; P.line([[x, y], [x + 6 + R() * 8, y + (R() - 0.5)]], { tool: 'pastelpencil', color: '#8a8e93', pressure: 0.35 }); }
    return save(P, 'card');
  },
  ground: () => {
    const w = 280, h = 320, P = sheet('ground', w, h, 2048, { base: '#d9c8a6', tooth: 0.6, fibre: 0.7 }), R = rng('ground');
    const X = (x) => ((x + 500) / 1400) * w, Z = (z) => ((z + 900) / 1600) * h, S = (m) => (m / 1400) * w;
    const shoreX = (z) => 352 + Math.sin(-z * 0.022) * 13 + Math.sin(-z * 0.0062) * 20;
    const clear = (x, y, m) => Math.hypot(x - X(0), y - Z(0)) > S(m) && !(x > X(-185) && x < X(-75) && y > Z(-160) && y < Z(-77));
    for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h, rx = 14 + R() * 26, ry = 6 + R() * 10; if (!clear(x, y, 100)) continue; P.fill([D.ell(x, y, rx, ry)], R() < 0.5 ? '#cdb791' : '#e2d4b6', { tool: 'pastelpencil', pressure: 0.35, passes: 1, angle: 10 + R() * 20 }); }
    for (let i = 0; i < 46; i++) {
      const cx = R() * w, cy = R() * h; if (!clear(cx, cy, 95) || cx > X(330)) continue;
      const len = 20 + R() * 30, bend = (R() - 0.5) * 5;
      for (let k = 0; k < 3 + Math.floor(R() * 2); k++) { const pts = []; for (let t = 0; t <= 1.0001; t += 1 / 16) pts.push([cx + (t - 0.5) * len * (1 - k * 0.12), cy + k * 1.6 + Math.sin(t * Math.PI) * bend]); P.line(pts, { tool: 'pencil', color: '#ad9168', pressure: 0.42 - k * 0.06, tremor: 0.45 }); }
    }
    for (let i = 0; i < 260; i++) {
      const x = R() * X(320), y = R() * h; if (!clear(x, y, 90)) continue;
      const n = 4 + Math.floor(R() * 5), col = R() < 0.5 ? '#8a9361' : '#a3a06e';
      for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (R() - 0.5) * 1.3, l = 1.1 + R() * 1.2; P.line([[x + (R() - 0.5) * 1.6, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], { tool: 'pencil', color: col, pressure: 0.85, tremor: 0.3 }); }
    }
    const pad = D.ell(X(0), Z(0), S(62), S(62));
    P.fill([pad], '#cfcdc6', { tool: 'pastelpencil', pressure: 0.95, passes: 3 });
    P.hatch([pad], '#b3b1aa', { angle: 20, pitch: 1.1, nib: 0.14, length: 20 });
    for (let k = -4; k <= 4; k++) { P.line([[X(k * 14), Z(-60)], [X(k * 14), Z(60)]], { tool: 'pencil', color: '#a19f98', pressure: 0.45, clip: [pad] }); P.line([[X(-60), Z(k * 14)], [X(60), Z(k * 14)]], { tool: 'pencil', color: '#a19f98', pressure: 0.45, clip: [pad] }); }
    P.fill([D.ell(X(0), Z(0), S(9), S(9))], '#4a4644', { tool: 'pencil', pressure: 0.9, passes: 3 });
    P.outline([pad], { color: '#86847e', nib: 0.32 });
    const farm = [[X(-182), Z(-158)], [X(-78), Z(-158)], [X(-78), Z(-79)], [X(-182), Z(-79)]];
    P.fill([farm], '#c9c7c0', { tool: 'pastelpencil', pressure: 0.9, passes: 2 });
    P.outline([farm], { color: '#8b8983', nib: 0.28 });
    for (const [a, b] of [[[X(-78), Z(-110)], [X(-42), Z(-50)]], [[X(60), Z(10)], [X(300), Z(30)]], [[X(-182), Z(-115)], [X(-500), Z(-140)]]]) { P.line([a, b], { tool: 'pastelpencil', color: '#bdb9ae', pressure: 1, blunt: true }); P.line([a, b], { tool: 'pencil', color: '#908c82', pressure: 0.4 }); }
    const line = (dx) => { const pts = []; for (let y = -2; y <= h + 2; y += 2) pts.push([X(shoreX((y / h) * 1600 - 900) + dx), y]); return pts; };
    P.fill([[...line(-48), ...line(40).reverse()]], '#e8dab8', { tool: 'pastelpencil', pressure: 0.9, passes: 2 });
    P.fill([[...line(-12), ...line(40).reverse()]], '#c9b48c', { tool: 'pastelpencil', pressure: 0.75, passes: 2 });
    for (let k = 0; k < 3; k++) P.line(line(-18 - k * 9), { tool: 'pencil', color: '#b8a07a', pressure: 0.35, tremor: 0.5 });
    P.line(line(0), { tool: 'pencil', color: '#8f7a58', pressure: 0.6 });
    return save(P, 'ground');
  },
  hotring: () => {
    const w = 89, h = 6.4, P = sheet('hotring', w, h, 1024, { base: '#bcc1c0', tooth: 0.5, fibre: 0.45 });
    steelBase(P, w, h, 'hotring', { ring: 100, brush: 60 });
    for (const [x0, x1, y0, y1] of VENTS(w, h)) {
      const r = 0.32, slot = [[x0, y0 + r], [x0 + r, y0], [x1 - r, y0], [x1, y0 + r], [x1, y1 - r], [x1 - r, y1], [x0 + r, y1], [x0, y1 - r]], soot = (x1 - x0) * 0.4;
      P.fill([[[x0 - soot, y0 - 0.45], [x1 + soot, y0 - 0.45], [x1 + soot * 0.6, y1 + 0.35], [x0 - soot * 0.6, y1 + 0.35]]], '#5b5250', { tool: 'graphite', pressure: 0.2, passes: 1 });
      P.fill([slot], '#1d1a1b', { tool: 'pencil', pressure: 1, passes: 3 });
      P.outline([slot], { color: '#3b3536', nib: 0.18 });
    }
    for (const y of [0.3, h - 0.3]) { const pts = []; for (let x = -1; x <= w + 1; x += 3) pts.push([x, y]); P.line(pts, { tool: 'pencil', color: '#5d6266', pressure: 0.85 }); }
    return save(P, 'hotring');
  },
  grain: () => { const P = sheet('grain', 50, 50, 512, 'hotpress'); return save(P, 'grain'); },
  sea: () => {
    const w = 120, P = sheet('sea', w, w, 1024, { base: '#5d8f97', tooth: 0.6, fibre: 0.55 }), R = rng('sea');
    for (let i = 0; i < 120; i++) { const x = R() * w, y = R() * w, l = 6 + R() * 12, pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([x + t * l, y + Math.sin(t * Math.PI) * -0.8]); } P.line(pts, { tool: 'pastelpencil', color: R() < 0.55 ? '#d8ece8' : '#3f6f78', pressure: 0.45 + R() * 0.4, tremor: 0.4 }); }
    return save(P, 'sea');
  },
  curtain: () => {
    const w = 160, h = 100, P = sheet('curtain', w, h, 1600, { base: '#3b2f47', tooth: 0.55, fibre: 0.6 }), R = rng('curtain');
    const sway = (x, y) => x + Math.sin(y * 0.045 + x * 0.3) * 0.7 * (y / h);
    let x = -3;
    while (x < w + 3) {
      const fw = 7 + R() * 7;
      for (let k = 0; k <= 30; k++) {
        const t = k / 30, shade = Math.sin(t * Math.PI * 2 - Math.PI / 2), xx = x + fw * t;
        if (Math.abs(shade) < 0.3) continue;
        const pts = []; for (let y = 8; y <= h + 1; y += 3) pts.push([sway(xx, y) + (R() - 0.5) * 0.15, y]);
        P.line(pts, { tool: 'pastelpencil', color: shade > 0 ? (shade > 0.8 ? '#62526f' : '#504262') : shade < -0.8 ? '#1c1626' : '#2a2136', pressure: 0.3 + Math.abs(shade) * 0.45, tremor: 0.35 });
      }
      x += fw;
    }
    for (let i = 0; i < 900; i++) { const xx = R() * w, y = 8 + R() * (h - 8), l = 3 + R() * 9; P.line([[xx, y], [xx + (R() - 0.5) * 0.4, y + l]], { tool: 'pastelpencil', color: R() < 0.5 ? '#4a3b58' : '#2c2338', pressure: 0.2 + R() * 0.2, tremor: 0.3 }); }
    const swags = 5, sw = w / swags, arc = (i, t, depth) => [i * sw + t * sw, depth * Math.sin(t * Math.PI) + 5.5];
    for (let i = 0; i < swags; i++) {
      const poly = [[i * sw - 0.5, -1], [(i + 1) * sw + 0.5, -1]];
      for (let k = 20; k >= 0; k--) poly.push(arc(i, k / 20, 7));
      P.fill([poly], '#46375a', { tool: 'pastelpencil', pressure: 1, passes: 3, angle: 4 });
      for (let d = 1.5; d <= 6.5; d += 1.25) { const pts = []; for (let k = 0; k <= 20; k++) pts.push(arc(i, k / 20, d)); P.line(pts, { tool: 'pastelpencil', color: d % 2.5 < 1.25 ? '#2a2136' : '#65527a', pressure: 0.45, tremor: 0.3 }); }
      const edge = []; for (let k = 0; k <= 24; k++) edge.push(arc(i, k / 24, 7));
      P.line(edge, { tool: 'pastelpencil', color: '#e2b33f', pressure: 0.85, tremor: 0.25 });
      P.line(edge.map(([ex, ey]) => [ex, ey + 0.6]), { tool: 'pencil', color: '#7a5a1c', pressure: 0.5, tremor: 0.25 });
      const tx = (i + 1) * sw;
      if (i < swags - 1) { P.line([[tx, 5], [tx, 13]], { tool: 'pastelpencil', color: '#e2b33f', pressure: 0.9, tremor: 0.2 }); for (let k = -3; k <= 3; k++) P.line([[tx + k * 0.25, 12.5], [tx + k * 0.45, 16 + R()]], { tool: 'pastelpencil', color: '#d9a531', pressure: 0.7, tremor: 0.3 }); }
    }
    P.fill([[[-1, -1], [w + 1, -1], [w + 1, 6], [-1, 6]]], '#2b2238', { tool: 'pastelpencil', pressure: 1, passes: 4, angle: 3 });
    for (let i = 0; i < 160; i++) { const xx = R() * w, l = 4 + R() * 12; P.line([[xx, 0.5 + R() * 4.5], [xx + l, 0.5 + R() * 4.5]], { tool: 'pastelpencil', color: R() < 0.5 ? '#3a2e4a' : '#211a2c', pressure: 0.3, tremor: 0.3 }); }
    P.line([[-1, 5.6], [w + 1, 5.6]], { tool: 'pastelpencil', color: '#c9982e', pressure: 0.8, tremor: 0.25 });
    P.line([[-1, h - 2.4], [w + 1, h - 2.4]], { tool: 'pastelpencil', color: '#c9982e', pressure: 0.75, tremor: 0.3 });
    for (let fx = 0.4; fx < w; fx += 0.9) P.line([[fx, h - 2.2], [fx + (R() - 0.5) * 0.3, h - 0.2 + R() * 0.3]], { tool: 'pencil', color: R() < 0.5 ? '#b8892a' : '#e2b33f', pressure: 0.55, tremor: 0.2 });
    return save(P, 'curtain');
  },
  sky: () => {
    const w = 200, h = 200, P = sheet('sky', w, h, 2048, { base: '#4c4270', tooth: 0.45, fibre: 0.4 }), R = rng('sky');
    const stops = [[0, [13, 14, 30]], [0.34, [18, 21, 48]], [0.5, [38, 36, 84]], [0.62, [74, 60, 128]], [0.72, [128, 98, 166]], [0.8, [190, 132, 170]], [0.87, [226, 160, 160]], [0.93, [240, 190, 160]], [1, [246, 216, 180]]];
    const at = (t) => { let i = 0; while (i < stops.length - 2 && stops[i + 1][0] < t) i++; const [a, ca] = stops[i], [b, cb] = stops[i + 1], u = Math.max(0, Math.min(1, (t - a) / (b - a))); return ca.map((c, k) => Math.round(c + (cb[k] - c) * u)); };
    const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
    for (let y = -1; y < h + 1; y += 2.2) P.fill([[[-2, y - 1.6], [w + 2, y - 1.6], [w + 2, y + 3.8], [-2, y + 3.8]]], hex(at(y / h)), { tool: 'pastelpencil', pressure: 1, passes: 3, angle: 2 + R() * 4 });
    for (let i = 0; i < 1400; i++) { const y = R() * h, x = R() * w, l = 4 + R() * 16, c = at(Math.min(1, Math.max(0, y / h + (R() - 0.5) * 0.04))); P.line([[x, y], [x + l, y + (R() - 0.5) * 0.8]], { tool: 'pastelpencil', color: hex(c.map((v) => Math.min(255, Math.max(0, v + (R() < 0.5 ? 8 : -8))))), pressure: 0.3 + R() * 0.3, tremor: 0.3 }); }
    for (let i = 0; i < 26; i++) { const y = (0.74 + R() * 0.22) * h, x = R() * w, l = 30 + R() * 60; for (let k = 0; k < 6; k++) P.line([[x + k * 1.5, y + k * 0.5], [x + l - k * 3, y + k * 0.5 + (R() - 0.5)]], { tool: 'pastelpencil', color: R() < 0.6 ? '#f6d2b8' : '#c79ac0', pressure: 0.3 + R() * 0.25, tremor: 0.35 }); }
    return save(P, 'sky');
  },
};

function VENTS(w, h, n = 26) { const out = []; for (let i = 0; i < n; i++) { const x = ((i + 0.5) * w) / n, hw = (w / n) * 0.34; out.push([x - hw, x + hw, 1.05, h - 1.05]); } return out; }
function hotvents() {
  const w = 89, h = 6.4, W = 1024, H = Math.round((h * W) / w), { c, g } = alphaCanvas(W, H), k = W / w;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  for (const [x0, x1, y0, y1] of VENTS(w, h)) {
    const grad = g.createLinearGradient(0, y0 * k, 0, y1 * k);
    grad.addColorStop(0, '#ffe2a8'); grad.addColorStop(0.5, '#ffb35a'); grad.addColorStop(1, '#ff7a3a');
    g.fillStyle = grad; g.fillRect(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k);
  }
  return c;
}
function alphaCanvas(w, h) { const c = createCanvas(w, h); return { c, g: c.getContext('2d') }; }
function cotton() {
  const { c, g } = alphaCanvas(512, 512), R = rng('cotton');
  const base = g.createRadialGradient(256, 262, 0, 256, 262, 200);
  base.addColorStop(0, 'rgba(250,247,240,0.78)'); base.addColorStop(0.55, 'rgba(244,240,232,0.42)'); base.addColorStop(1, 'rgba(240,236,228,0)');
  g.fillStyle = base; g.beginPath(); g.ellipse(256, 262, 205, 190, 0, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 2600; i++) {
    const a = R() * Math.PI * 2, r = Math.pow(R(), 0.55) * 210, x = 256 + Math.cos(a) * r, y = 256 + Math.sin(a) * r * 0.92, l = 14 + R() * 34, b = a + (R() - 0.5) * 2.4;
    const shade = 228 + R() * 27 - (y - 256) * 0.05;
    g.strokeStyle = `rgba(${shade},${shade - 3},${shade - 8},${0.05 + (1 - r / 210) * 0.16})`;
    g.lineWidth = 1 + R() * 1.6;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(b) * l * 0.6 + (R() - 0.5) * 10, y + Math.sin(b) * l * 0.6 + (R() - 0.5) * 10, x + Math.cos(b) * l, y + Math.sin(b) * l); g.stroke();
  }
  return c;
}
function tissue() {
  const { c, g } = alphaCanvas(256, 512), R = rng('tissue');
  const layers = [['224,104,120', 0.3, 0.98], ['246,140,96', 0.4, 0.8], ['255,196,110', 0.5, 0.6], ['255,240,196', 0.65, 0.36]];
  for (const [col, al, len] of layers) {
    for (let k = 0; k < 5; k++) {
      g.fillStyle = `rgba(${col},${al * (0.45 + R() * 0.35)})`;
      g.beginPath(); g.moveTo(-2, 0); g.lineTo(-2, len * 512 * (0.7 + R() * 0.2));
      for (let x = 0; x <= 258; x += 12) g.lineTo(x, len * 512 * (0.72 + R() * 0.3) + Math.sin(x * 0.07 + k) * 12);
      g.lineTo(258, 0); g.closePath(); g.fill();
    }
  }
  for (let i = 0; i < 70; i++) { const x = R() * 256, y = R() * 400; g.strokeStyle = `rgba(255,250,230,${0.08 + R() * 0.12})`; g.lineWidth = 1 + R() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 6, y + 20 + R() * 60); g.stroke(); }
  return c;
}
function gridfin() {
  const { c, g } = alphaCanvas(256, 256);
  g.fillStyle = '#7c7f84'; g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'destination-out';
  const n = 7, m = 18, cell = (256 - 2 * m) / n, bar = cell * 0.22;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.save(); g.translate(m + (i + 0.5) * cell, m + (j + 0.5) * cell); g.rotate(Math.PI / 4); g.fillRect(-(cell - bar) / 2 * 0.95, -(cell - bar) / 2 * 0.95, (cell - bar) * 0.95, (cell - bar) * 0.95); g.restore(); }
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = 'rgba(40,40,44,0.8)'; g.lineWidth = 3; g.strokeRect(m / 2, m / 2, 256 - m, 256 - m);
  return c;
}
function truss() {
  const { c, g } = alphaCanvas(1024, 128);
  g.fillStyle = '#4e5156'; g.fillRect(0, 0, 1024, 128);
  for (let i = 0; i < 1024; i += 3) { g.fillStyle = `rgba(30,32,36,${0.08 + ((i * 7) % 11) / 90})`; g.fillRect(i, 0, 1, 128); }
  g.globalCompositeOperation = 'destination-out';
  const top = 22, bottom = 106, w = 128;
  for (let x = 0; x < 1024; x += w) {
    g.beginPath(); g.moveTo(x + 16, bottom - 8); g.lineTo(x + w / 2, top + 8); g.lineTo(x + w - 16, bottom - 8); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x + w / 2 + 16, top + 8); g.lineTo(x + w + w / 2 - 16, top + 8); g.lineTo(x + w, bottom - 8); g.closePath(); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = 'rgba(20,20,24,0.9)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 1021, 125);
  return c;
}
function frost() {
  const { c, g } = alphaCanvas(512, 1024), R = rng('frost');
  for (let i = 0; i < 9000; i++) {
    const x = R() * 512, y = Math.pow(R(), 0.85) * 1024, a = (0.1 + R() * 0.35) * Math.min(1, y / 140);
    g.fillStyle = `rgba(${236 + R() * 19},${242 + R() * 13},250,${a})`;
    const w = 1 + R() * 3, hgt = 1 + R() * 9; g.fillRect(x, y, w, hgt);
  }
  for (let i = 0; i < 260; i++) { const x = R() * 512, y = 100 + R() * 924, l = 30 + R() * 90; g.strokeStyle = `rgba(250,252,255,${0.08 + R() * 0.16})`; g.lineWidth = 1 + R() * 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 6, y + l); g.stroke(); }
  return c;
}
function glow() {
  const { c, g } = alphaCanvas(128, 128), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return c;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, fn] of Object.entries(TEX)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const t0 = Date.now(); await fn(); console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  for (const [name, fn] of [['cotton', cotton], ['tissue', tissue], ['glow', glow], ['frost', frost], ['gridfin', gridfin], ['truss', truss], ['hotvents', hotvents]]) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    fs.writeFileSync(path.join(OUT, name + '.png'), await fn().encode('png')); console.log(name);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
